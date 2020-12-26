import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExistent = await this.customersRepository.findById(
      customer_id,
    );

    if (!customerExistent) {
      throw new AppError('Customer does not exist');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (existentProducts.length <= 0) {
      throw new AppError('Products does not exist');
    }

    const existentProductsIds = existentProducts.map(product => product.id);

    const UnexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (UnexistentProducts.length > 0) {
      throw new AppError(`Could not find products ${UnexistentProducts[0].id}`);
    }

    const findProductsWithNoQuantity = products.filter(
      product =>
        existentProducts.filter(existentP => existentP.id === product.id)[0]
          .quantity < product.quantity,
    );

    if (findProductsWithNoQuantity.length) {
      throw new AppError(
        `The quantity ${findProductsWithNoQuantity[0].quantity} is not available for ${findProductsWithNoQuantity[0].id}`,
      );
    }

    const serializesProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExistent,
      products: serializesProducts,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        existentProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
