import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function main() {
    console.log('🌱 Start seeding...');

    // Hacher le mot de passe pour le super admin
    const hashedSuperAdminPassword = await bcrypt.hash('Admin@2026', 10);

    // Création du Super Admin
    const superAdmin = await prisma.administrateur.upsert({
        where: { userId: 'SA-001' },
        update: {
            email: 'obedburindi@gmail.com',
            role: 'superadmin',
            actif: true,
        },
        create: {
            nom: 'MWANGAZA',
            prenom: 'SuperAdmin',
            email: 'obedburindi@gmail.com',
            telephone: '+243000000000',
            motDePasse: hashedSuperAdminPassword,
            role: 'superadmin',
            actif: true,
            userId: 'SA-001',
        },
    });
    console.log(`✅ Super Admin created: ${superAdmin.email}`);

    // Hacher le mot de passe pour un admin standard
    const hashedAdminPassword = await bcrypt.hash('Admin@123', 10);

    // Création d'un Admin standard
    const admin = await prisma.administrateur.upsert({
        where: { userId: 'AD-001' },
        update: {
            email: 'makasimumbere22@gmail.com',
            role: 'admin',
            actif: true,
        },
        create: {
            nom: 'MAKASI',
            prenom: 'Mumbere',
            email: 'makasimumbere22@gmail.com',
            telephone: '+243975833890',
            motDePasse: hashedAdminPassword,
            role: 'admin',
            actif: true,
            userId: 'AD-001',
        },
    });
    console.log(`✅ Admin created: ${admin.email}`);

    const secondAdmin = await prisma.administrateur.upsert({
        where: { userId: 'AD-002' },
        update: {
            email: 'kitavulameschack@gmail.com',
            role: 'admin',
            actif: true,
        },
        create: {
            nom: 'KITAVULA',
            prenom: 'Meschack',
            email: 'kitavulameschack@gmail.com',
            telephone: '+243970364967',
            motDePasse: hashedAdminPassword,
            role: 'admin',
            actif: true,
            userId: 'AD-002',
        },
    });
    console.log(`✅ Admin created: ${secondAdmin.email}`);

    // Création d'un agent (caissier/guichet) de démonstration
    const hashedAgentPassword = await bcrypt.hash('Agent@123', 10);
    const agent = await prisma.agent.upsert({
        where: { email: 'agent-mwangaza@gmail.com' },
        update: {},
        create: {
            nom: 'Agent Démo',
            email: 'agent-mwangaza@gmail.com',
            telephone: '+243800000001',
            guichetAssigne: 'Guichet 1',
            soldeInitial: 0,
            devise: 'USD',
            actif: true,
            motDePasse: hashedAgentPassword,
            userId: 'AG-001',
        },
    });
    console.log(`✅ Agent created: ${agent.email}`);

    // --- INITIALISATION DES SECTIONS ET COMPTES SYSTÈME ---
    console.log('🔄 Initialisation des sections et comptes système...');
    const sections = [
        { nom: 'PRINCIPAL', code: 'PRI' },
        { nom: 'KELASI', code: 'KEL' },
        { nom: 'NYUMBA', code: 'NYU' },
        { nom: 'HOPITAL', code: 'HOP' },
        { nom: 'BIASHARA', code: 'BIA' },
        { nom: 'MUTOTO', code: 'MUT' },
    ];

    for (const sec of sections) {
        const sectionTrigram = sec.code;
        const compteCollectif = `MW-${sectionTrigram}-SECTION-0000`;

        // 1. Créer/Mettre à jour la Section
        await prisma.section.upsert({
            where: { nom: sec.nom },
            update: { numeroCompte: compteCollectif },
            create: {
                nom: sec.nom,
                numeroCompte: compteCollectif,
                solde: 0,
            },
        });

        // 2. Créer le compte Membre lié au collectif
        await prisma.membre.upsert({
            where: { numeroCompte: compteCollectif },
            update: {},
            create: {
                numeroCompte: compteCollectif,
                nomComplet: `Compte Collectif ${sec.nom}`,
                typeCompte: sec.nom,
                telephone: `SYS-${compteCollectif}`, // Unicité garantie
                dateAdhesion: new Date(),
                statut: 'actif',
            }
        });

        // 3. Créer le compte de CRÉDITS (transit trésorerie) de la section
        const creditAccount = `MW-${sectionTrigram}-CREDITS`;
        await prisma.membre.upsert({
            where: { numeroCompte: creditAccount },
            update: {},
            create: {
                numeroCompte: creditAccount,
                nomComplet: `CRÉDITS ${sec.nom}`,
                typeCompte: sec.nom,
                telephone: `SYS-${creditAccount}`, // Unicité garantie
                dateAdhesion: new Date(),
                statut: 'actif',
            }
        });

        console.log(`✅ Section ${sec.nom} prête (Collectif: ${compteCollectif}, Crédits: ${creditAccount})`);
    }

    // --- INITIALISATION DES TYPES DE REVENUS ---
    console.log('🔄 Initialisation des types de revenus...');
    const revenueTypes = [
        { nom: 'Système Membre', description: 'Revenus issus des frais d\'adhésion et de gestion des membres' },
        { nom: 'Système Retrait', description: 'Revenus issus des frais de retrait' },
        { nom: 'Système Crédit', description: 'Revenus issus des frais d\'octroi de crédit' },
        { nom: 'Système Remboursement', description: 'Revenus issus des intérêts sur remboursements' },
    ];

    for (const type of revenueTypes) {
        await prisma.revenuType.upsert({
            where: { nom: type.nom },
            update: { description: type.description },
            create: {
                nom: type.nom,
                description: type.description,
            },
        });
    }
    console.log('✅ Types de revenus prêts.');

    // Les anciens pseudo-membres de revenus sont conservés pour les clés étrangères,
    // mais désactivés. Les revenus futurs proviennent du compte de résultat.
    await prisma.membre.updateMany({
        where: { OR: [{ numeroCompte: { contains: '-REVENUS' } }, { numeroCompte: 'MW-REVENUS-GLOBAL' }] },
        data: { statut: 'inactif' },
    });

    // Création du compte GLOBAL TRÉSORERIE CRÉDITS
    await prisma.membre.upsert({
        where: { numeroCompte: 'MW-TRESORERIE-CREDITS' },
        update: {},
        create: {
            numeroCompte: 'MW-TRESORERIE-CREDITS',
            nomComplet: 'TRÉSORERIE CRÉDITS GLOBAL',
            typeCompte: 'SYSTEME',
            telephone: 'SYS-GLOBAL-CRED',
            dateAdhesion: new Date(),
            statut: 'actif'
        }
    });

    // --- INITIALISATION DES PARAMÈTRES GÉNÉRAUX ---
    console.log('🔄 Initialisation des paramètres généraux...');
    const defaultParams = {
        solde_min_fc: 10000,
        solde_min_usd: 5,
        montant_min_depot_fc: 1000,
        montant_min_depot_usd: 1,
        montant_min_retrait_fc: 5000,
        montant_min_retrait_usd: 5,
        limite_retrait_jour_fc: 50000000,
        limite_retrait_jour_usd: 5000000,
        max_retraits_par_jour: 5,
        montant_max_par_retrait_fc: 500000,
        montant_max_par_retrait_usd: 500,
        taux_usd_cdf: 2217.268,
        heures_autorisees: { debut: '08:00', fin: '22:00' },
        motif_obligatoire: true,
        retraits: {
            frais_retrait: {
                FC: [
                    { max: 50000, taux: 0.03 },
                    { max: 500000, taux: 0.025 },
                    { max: 999999999, taux: 0.02 },
                ],
                USD: [
                    { max: 50, taux: 0.03 },
                    { max: 500, taux: 0.025 },
                    { max: 999999, taux: 0.02 },
                ],
            },
        },
    };

    await prisma.parametreEpargne.upsert({
        where: { nomParametre: 'parametres_generaux' },
        update: {},
        create: {
            nomParametre: 'parametres_generaux',
            valeur: JSON.stringify(defaultParams),
            description: 'Paramètres généraux de gestion de la coopérative',
        },
    });
    console.log('✅ Paramètres généraux initialisés.');

    console.log('✅ Tous les comptes système sont prêts.');
    console.log('🏁 Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
