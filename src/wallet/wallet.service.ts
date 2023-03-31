import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { CreateWalletDto } from './dto/create-wallet.dto'
import { Transaction } from './transaction.model'
import { Wallet } from './wallet.model'
import { WalletPageDto } from './dto/wallet-page.dto'
import { OperationType } from './types/OperationType.type'

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(Wallet) private walletRepository: typeof Wallet,
    @InjectModel(Transaction) private transactionRepository: typeof Transaction
  ) {}

  async getWallets(userId: string) {
    return this.walletRepository.findAll({ where: { userId } })
  }

  async getTransactions(userId: string, walletDto: WalletPageDto, operation_type: OperationType) {
    const wallet = await this.walletRepository.findOne({ where: { id: walletDto.walletId, userId } })

    if (!wallet) {
      throw new HttpException({ message: 'Кошелек не найден' }, HttpStatus.BAD_REQUEST)
    }

    return this.transactionRepository.findAll({
      where: { walletId: wallet.id, operation_type },
      offset: walletDto.skip,
      limit: walletDto.take,
      order: [['created_at', 'DESC']],
    })
  }

  async createWallet(dto: CreateWalletDto, userId: string) {
    return this.walletRepository.create({ title: dto.title, userId })
  }

  async createTransaction(transactionDto: CreateTransactionDto, userId: string) {
    const wallet = await this.walletRepository.findOne({ where: { id: transactionDto.walletId, userId } })

    if (!wallet) {
      throw new HttpException({ message: 'Кошелек не найлен' }, HttpStatus.BAD_REQUEST)
    }

    const currentBalance = wallet.balance
    const transaction = await this.transactionRepository.create(transactionDto)
    let newBalance

    if (transactionDto.operation_type === 'INCOME') {
      newBalance = currentBalance + transactionDto.amount
      await wallet.update({ balance: newBalance })
    } else {
      newBalance = currentBalance - transactionDto.amount

      if (newBalance < 0) {
        throw new HttpException({ message: 'Недостаточно средств на счете' }, HttpStatus.BAD_REQUEST)
      }

      await wallet.update({ balance: newBalance })
    }

    return { transaction, balance: newBalance }
  }
}
