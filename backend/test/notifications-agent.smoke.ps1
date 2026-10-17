# Smoke test du module notifications - profil AGENT (guichet)
# Usage : powershell -File test\notifications-agent.smoke.ps1
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000/api'

function Invoke-Json($Method, $Path, $Body, $Token) {
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  $params = @{ Method = $Method; Uri = "$base$Path"; Headers = $headers }
  if ($Body) { $params['Body'] = ($Body | ConvertTo-Json -Compress) }
  try {
    return Invoke-RestMethod @params
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    return [pscustomobject]@{ __error = $true; __status = $status; __detail = $_.Exception.Message }
  }
}

# 1. Attendre le demarrage du serveur
$up = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    Invoke-WebRequest -Uri "$base/.." -UseBasicParsing -TimeoutSec 2 | Out-Null
    $up = $true; break
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -gt 0) { $up = $true; break }
    Start-Sleep -Seconds 2
  }
}
if (-not $up) { Write-Output 'FAIL: serveur indisponible'; exit 1 }

# 2. Connexions
$admin = Invoke-Json POST '/auth/admin/login' @{ email = 'superadmin@mwangaza.cd'; password = 'Admin@2026' }
$agent = Invoke-Json POST '/auth/agent/login' @{ email = 'agent@mwangaza.cd'; password = 'Agent@123' }
if (-not $admin.token) { Write-Output "FAIL login admin: $($admin | ConvertTo-Json -Compress)"; exit 1 }
if (-not $agent.token) { Write-Output "FAIL login agent: $($agent | ConvertTo-Json -Compress)"; exit 1 }
$adminT = $admin.token; $agentT = $agent.token

$me = Invoke-Json GET '/auth/me' $null $agentT
$agentId = $me.user.id
Write-Output "OK login - agent id=$agentId role=$($me.user.role)"
if (-not $agentId) { Write-Output 'FAIL: id agent absent de /auth/me'; exit 1 }

# 2b. Nettoyage prealable (test idempotent)
$testTitles = @('Caisse a approvisionner', 'Assemblee generale ordinaire', 'X')
$existing = Invoke-Json GET '/notifications?page=1&pageSize=100' $null $adminT
foreach ($n in @($existing.data)) {
  if ($testTitles -contains $n.titre) { Invoke-Json DELETE "/notifications/$($n.id)" $null $adminT | Out-Null }
}

# 3. Notification CIBLEE vers l'agent (creee par l'admin)
$targeted = Invoke-Json POST '/notifications' @{
  agentId = $agentId
  titre   = 'Caisse a approvisionner'
  message = 'Guichet 2 : solde USD sous le seuil.'
  type    = 'rappel'
} $adminT
if ($targeted.__error) { Write-Output "FAIL create ciblee: $($targeted | ConvertTo-Json -Compress)"; exit 1 }

# 4. Diffusion GENERALE (membres + agents)
$broadcast = Invoke-Json POST '/notifications' @{
  titre   = 'Assemblee generale ordinaire'
  message = 'Rendez-vous le 15 novembre a 9h.'
  type    = 'service'
} $adminT
if ($broadcast.__error) { Write-Output "FAIL create diffusion: $($broadcast | ConvertTo-Json -Compress)"; exit 1 }

# 5. L'agent voit les 2 (ciblee + diffusion)
$list = Invoke-Json GET '/notifications/moi?page=1&pageSize=50' $null $agentT
$ids = @($list.data | ForEach-Object { $_.id })
Write-Output "OK /moi => total=$($list.total) nonLues=$($list.nonLues) ids=$($ids -join ',')"
if ($list.total -lt 2) { Write-Output 'FAIL: l agent ne voit pas ses 2 notifications'; exit 1 }
if ($ids -notcontains $targeted.id) { Write-Output 'FAIL: notification ciblee absente'; exit 1 }
if ($ids -notcontains $broadcast.id) { Write-Output 'FAIL: diffusion absente'; exit 1 }

# 6. Compteur non-lues
$unread = Invoke-Json GET '/notifications/moi/non-lues' $null $agentT
Write-Output "OK non-lues => $($unread.count)"
if ($unread.count -lt 2) { Write-Output 'FAIL: compteur non-lues'; exit 1 }

# 7. Accuse de lecture sur la notification ciblee
$read = Invoke-Json PATCH "/notifications/moi/$($targeted.id)/lire" $null $agentT
if (-not $read.isRead) { Write-Output 'FAIL: accuse de lecture'; exit 1 }
$unread2 = Invoke-Json GET '/notifications/moi/non-lues' $null $agentT
Write-Output "OK lecture => isRead=$($read.isRead), non-lues=$($unread2.count)"
if ($unread2.count -ne ($unread.count - 1)) { Write-Output 'FAIL: compteur apres lecture'; exit 1 }

# 8. L'agent ne peut PAS creer de notification (admin only)
$forbidden = Invoke-Json POST '/notifications' @{ titre = 'X'; message = 'Y' } $agentT
Write-Output "OK agent POST refuse => status=$($forbidden.__status)"
if ($forbidden.__status -ne 403) { Write-Output 'FAIL: le POST agent aurait du etre 403'; exit 1 }

# 9. Cible ambiguë refusee
$ambiguous = Invoke-Json POST '/notifications' @{
  membreId = 1; agentId = $agentId; titre = 'X'; message = 'Y'
} $adminT
Write-Output "OK cible ambigu => status=$($ambiguous.__status)"
if ($ambiguous.__status -ne 400) { Write-Output 'FAIL: cible ambigu aurait du etre 400'; exit 1 }

# 10. Filtre admin par agent
$adminList = Invoke-Json GET "/notifications?agentId=$agentId" $null $adminT
$adminIds = @($adminList.data | ForEach-Object { $_.id })
Write-Output "OK filtre agentId => total=$($adminList.total)"
if ($adminIds -notcontains $targeted.id) { Write-Output 'FAIL: filtre agentId'; exit 1 }

# 11. Nettoyage final
foreach ($n in @($targeted, $broadcast)) {
  $del = Invoke-Json DELETE "/notifications/$($n.id)" $null $adminT
  if ($del.__error) { Write-Output "WARN cleanup $($n.id)"; }
}
$leftover = Invoke-Json GET '/notifications?page=1&pageSize=100' $null $adminT
foreach ($n in @($leftover.data)) {
  if ($testTitles -contains $n.titre) { Invoke-Json DELETE "/notifications/$($n.id)" $null $adminT | Out-Null }
}

Write-Output 'ALL SMOKE TESTS PASSED'
