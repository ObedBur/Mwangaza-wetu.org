import { ConfigService } from '@nestjs/config';
import { ComptabiliteService } from './src/comptabilite/comptabilite.service';
import { PrismaService } from './src/prisma/prisma.service';

async function main() {
  // PrismaService a besoin d'un ConfigService pour lire DATABASE_URL
  // et construire son driver adapter (PrismaPg). ConfigService lit
  // process.env en repli, que Bun charge automatiquement.
  const prismaService = new PrismaService(new ConfigService());
  const service = new ComptabiliteService(prismaService);

  try {
    console.log("Test 1 : Enregistrement frais d'adhésion 2000 FC - Section BIASHARA (MW-BIA)");
    const op = await service.enregistrerAdhesion({
      montant: 2000,
      devise: 'FC' as any,
      codeSection: 'MW-BIA',
      motif: "Test adhésion BIASHARA",
    });

    console.log('Opération créée:', op.reference, '| statut:', op.statut);

    const check = await service.verifierEquilibre(op.id);
    console.log('Vérification équilibre:', check);

    if (check.equilibre) {
      console.log('✅ TEST RÉUSSI - Débit = Crédit');
    } else {
      console.log('❌ TEST ÉCHOUÉ - Écart:', check.ecart);
    }
  } catch (e) {
    console.error('Erreur:', e);
  } finally {
    await prismaService.$disconnect();
  }
}

main();
