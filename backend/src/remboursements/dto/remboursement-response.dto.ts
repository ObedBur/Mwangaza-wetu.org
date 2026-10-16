export class RemboursementResponseDto {
  id: number;
  creditId: number;
  montant: number;
  devise: string;
  dateRemboursement: Date;
  ventilation: {
    principal: number;
    interets: number;
  };
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
