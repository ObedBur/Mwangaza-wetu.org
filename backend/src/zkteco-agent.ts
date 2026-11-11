import 'dotenv/config';
import axios from 'axios';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { ZktecoService } from './zkteco/zkteco.service';

const config = new ConfigService();
const apiBase = (config.get<string>('ZKTECO_SERVER_URL') ?? '').replace(/\/+$/, '');
const token = config.get<string>('ZKTECO_AGENT_TOKEN') ?? '';
const pollMs = Number(config.get<string>('ZKTECO_AGENT_POLL_MS') ?? 15000);
const device = new ZktecoService(config);

if (!apiBase || !token || token.length < 32) {
  throw new Error(
    'Configurez ZKTECO_SERVER_URL et ZKTECO_AGENT_TOKEN (au moins 32 caractères) dans le .env local.',
  );
}

const http = axios.create({
  baseURL: `${apiBase}/api/zkteco/agent`,
  timeout: 20000,
  headers: { 'x-zkteco-agent-token': token },
});

let stopping = false;
const statePath = join(process.cwd(), 'zkteco-agent-state.json');
let lastUserSn = -1;
if (existsSync(statePath)) {
  try {
    const savedCursor = Number(JSON.parse(readFileSync(statePath, 'utf8')).lastUserSn);
    lastUserSn = Number.isFinite(savedCursor) ? savedCursor : -1;
  } catch {
    lastUserSn = -1;
    console.warn('État local du relais illisible ; reprise depuis les logs disponibles.');
  }
}

async function pushAttendances(): Promise<void> {
  const logs = await device.getAttendances();
  const numericLogs = logs.filter((log) => Number.isFinite(Number(log.userSn)));
  const maxUserSn = numericLogs.reduce(
    (maximum, log) => Math.max(maximum, Number(log.userSn)),
    0,
  );
  if (maxUserSn < lastUserSn) lastUserSn = -1; // Logs effacés puis recommencés sur l'appareil.
  const pending = numericLogs
    .filter((log) => Number(log.userSn) > lastUserSn)
    .sort((a, b) => Number(a.userSn) - Number(b.userSn));

  for (let index = 0; index < pending.length; index += 500) {
    await http.post('attendances', { logs: pending.slice(index, index + 500) });
  }
  if (pending.length) {
    lastUserSn = maxUserSn;
    writeFileSync(statePath, JSON.stringify({ lastUserSn }), 'utf8');
  }
  console.log(`Synchronisation ZKTeco : ${pending.length} nouveau(x) pointage(s).`);
}

async function runCommand(): Promise<void> {
  const response = await http.get('commands/next');
  const command = response.data?.command as
    | { id: string; action: string; payload?: { timeout?: number } }
    | null;
  if (!command) return;

  try {
    let result: unknown;
    switch (command.action) {
      case 'connect':
        result = await device.connect();
        break;
      case 'disconnect':
        await device.disconnect();
        result = true;
        break;
      case 'get_users':
        result = await device.getUsers();
        break;
      case 'get_attendances':
        result = await device.getAttendances();
        break;
      case 'clear_attendance':
        await device.clearAttendance();
        result = true;
        break;
      case 'capture_fingerprint':
        result = await device.captureFingerprint(command.payload?.timeout);
        break;
      case 'start_realtime':
        // Le relais envoie déjà les logs par lots au backend.
        result = true;
        break;
      default:
        throw new Error(`Commande ZKTeco inconnue : ${command.action}`);
    }
    await http.post(`commands/${command.id}/result`, { success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await http.post(`commands/${command.id}/result`, { success: false, error: message });
    console.error(`Commande ZKTeco ${command.action} échouée : ${message}`);
  }
}

async function loop(): Promise<void> {
  while (!stopping) {
    try {
      await http.post('heartbeat');
      await runCommand();
      await pushAttendances();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Relais ZKTeco : ${message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function shutdown(): Promise<void> {
  stopping = true;
  await device.disconnect();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
console.log(`Relais ZKTeco démarré vers ${apiBase}`);
void loop();
