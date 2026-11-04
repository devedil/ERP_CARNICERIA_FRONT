import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonCloseDirective,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  FormSelectDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { getApiErrorMessage } from '../core/api-error';
import {
  CashSession,
  Customer,
  ExchangeRate,
  InventoryLocation,
  PriceList,
  Product,
  ProductPrice,
  Sale
} from '../core/models/catalog.models';
import { CashService } from '../core/services/cash.service';
import { CustomerService } from '../core/services/customer.service';
import { ExchangeRateService } from '../core/services/exchange-rate.service';
import { InventoryService } from '../core/services/inventory.service';
import { PriceListService } from '../core/services/price-list.service';
import { ProductService } from '../core/services/product.service';
import { SalePaymentInput, SaleService } from '../core/services/sale.service';
import { decimalToScaled, multiplyDecimalsToSix, scaledToDecimal, sumDecimals } from '../core/utils/decimal';

type SaleLineForm = FormGroup<{
  product_id: FormControl<string>;
  unit_id: FormControl<string>;
  quantity: FormControl<string>;
}>;

@Component({
  selector: 'app-sales',
  templateUrl: './sales.component.html',
  imports: [
    ButtonCloseDirective,
    ButtonDirective,
    CardBodyComponent,
    CardComponent,
    CardHeaderComponent,
    ColComponent,
    FormControlDirective,
    FormDirective,
    FormLabelDirective,
    FormSelectDirective,
    ModalBodyComponent,
    ModalComponent,
    ModalFooterComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ReactiveFormsModule,
    RowComponent,
    TableDirective
  ]
})
export class SalesComponent implements OnInit {
  readonly #destroyRef = inject(DestroyRef);
  readonly #sales = inject(SaleService);
  readonly #productsApi = inject(ProductService);
  readonly #customersApi = inject(CustomerService);
  readonly #priceListsApi = inject(PriceListService);
  readonly #inventoryApi = inject(InventoryService);
  readonly #cashApi = inject(CashService);
  readonly #exchangeRatesApi = inject(ExchangeRateService);

  sales: Sale[] = [];
  products: Product[] = [];
  customers: Customer[] = [];
  priceLists: PriceList[] = [];
  locations: InventoryLocation[] = [];
  openSessions: CashSession[] = [];
  exchangeRate: ExchangeRate | null = null;
  exchangeRateError = '';
  exchangeRateLoading = false;
  readonly productPrices = new Map<number, ProductPrice[]>();
  loading = false;
  saving = false;
  page = 1;
  lastPage = 1;
  total = 0;
  pageError = '';
  formError = '';
  successMessage = '';
  saleModalVisible = false;
  paymentModalVisible = false;
  selectedSale: Sale | null = null;
  readonly saleForm = new FormGroup({
    customer_id: new FormControl('', { nonNullable: true }),
    price_list_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    inventory_location_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    payment_mode: new FormControl<'immediate' | 'credit'>('immediate', { nonNullable: true }),
    cash_session_id: new FormControl('', { nonNullable: true }),
    payment_method: new FormControl('cash', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    lines: new FormArray<SaleLineForm>([this.createLine()])
  });
  readonly paymentForm = new FormGroup({
    cash_session_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    payment_method: new FormControl('cash', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,6})?$/)]
    }),
    exchange_rate: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^\d+(\.\d{1,6})?$/)]
    })
  });

  ngOnInit(): void {
    this.load();
  }

  get lines(): FormArray<SaleLineForm> {
    return this.saleForm.controls.lines;
  }

  get selectedPriceList(): PriceList | undefined {
    return this.priceLists.find((item) => String(item.id) === this.saleForm.controls.price_list_id.value);
  }

  get selectedPaymentSession(): CashSession | undefined {
    return this.openSessions.find((item) => String(item.id) === this.saleForm.controls.cash_session_id.value);
  }

  openSessionsForCurrency(): CashSession[] {
    return this.openSessions.filter((session) => session.currency === 'VES');
  }

  load(page = this.page): void {
    this.loading = true;
    this.pageError = '';
    this.exchangeRateLoading = true;
    this.exchangeRateError = '';
    forkJoin({
      sales: this.#sales.list(page),
      products: this.#productsApi.list(),
      customers: this.#customersApi.list(),
      priceLists: this.#priceListsApi.list(true),
      locations: this.#inventoryApi.locations(),
      sessions: this.#cashApi.sessions(),
      exchangeRate: this.#exchangeRatesApi.current().pipe(
        catchError((error: unknown) => {
          this.exchangeRateError = getApiErrorMessage(error);
          return of(null);
        })
      )
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (result) => {
          this.sales = result.sales.data;
          this.page = result.sales.meta.current_page;
          this.lastPage = result.sales.meta.last_page;
          this.total = result.sales.meta.total;
          this.products = result.products.data;
          this.customers = result.customers.data;
          this.priceLists = result.priceLists.data.filter((priceList) =>
            priceList.is_active &&
            priceList.currency === 'USD' &&
            (priceList.code === 'retail' || priceList.code === 'wholesale')
          );
          this.locations = result.locations.data;
          this.openSessions = result.sessions.data.filter((session) => session.status === 'open');
          this.exchangeRate = result.exchangeRate?.data ?? null;
          this.exchangeRateLoading = false;
        },
        error: (error: unknown) => {
          this.pageError = getApiErrorMessage(error);
          this.exchangeRateLoading = false;
        }
      });
  }

  openSale(): void {
    this.formError = '';
    this.saleForm.reset({
      customer_id: '',
      price_list_id: '',
      inventory_location_id: '',
      payment_mode: 'immediate',
      cash_session_id: '',
      payment_method: 'cash',
      notes: ''
    });
    this.lines.clear();
    this.lines.push(this.createLine());
    this.saleModalVisible = true;
  }

  addLine(): void {
    this.lines.push(this.createLine());
  }

  removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  onProductChanged(index: number): void {
    const line = this.lines.at(index);
    const productId = Number(line.controls.product_id.value);
    line.controls.unit_id.setValue('');
    if (!productId || this.productPrices.has(productId)) {
      return;
    }

    this.#productsApi.prices(productId)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (response) => this.productPrices.set(productId, response.data),
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  availablePrices(line: SaleLineForm): ProductPrice[] {
    const productId = Number(line.controls.product_id.value);
    const priceListId = Number(this.saleForm.controls.price_list_id.value);
    return (this.productPrices.get(productId) ?? [])
      .filter((price) => price.is_active && price.price_list.id === priceListId);
  }

  priceForLine(line: SaleLineForm): ProductPrice | undefined {
    const unitId = line.controls.unit_id.value;
    return this.availablePrices(line).find((price) =>
      (price.unit ? String(price.unit.id) : '') === unitId
    );
  }

  estimatedLineTotal(line: SaleLineForm): string {
    const price = this.priceForLine(line);
    const quantity = line.controls.quantity.value;
    if (!price || !quantity || !this.exchangeRate) {
      return '0.000000';
    }

    const unitPriceVes = multiplyDecimalsToSix(price.amount, this.exchangeRate.rate);
    return multiplyDecimalsToSix(quantity, unitPriceVes);
  }

  estimatedTotal(): string {
    return sumDecimals(this.lines.controls.map((line) => this.estimatedLineTotal(line)));
  }

  saveSale(): void {
    if (this.saleForm.invalid || this.saving) {
      this.saleForm.markAllAsTouched();
      return;
    }

    const values = this.saleForm.getRawValue();
    if (!values.lines.every((line) => line.product_id && line.quantity && this.priceForRawLine(line))) {
      this.formError = 'Selecciona productos con precio activo para la lista de precios elegida.';
      return;
    }
    if (new Set(values.lines.map((line) => line.product_id)).size !== values.lines.length) {
      this.formError = 'Cada producto solo puede aparecer una vez en la venta.';
      return;
    }
    if (values.payment_mode === 'credit' && !values.customer_id) {
      this.formError = 'Las ventas a crédito requieren seleccionar un cliente.';
      return;
    }

    const priceList = this.priceLists.find((item) => String(item.id) === values.price_list_id);
    if (!priceList) {
      this.formError = 'Selecciona una lista de precios activa.';
      return;
    }
    if (!this.exchangeRate || this.exchangeRateError) {
      this.formError = 'No hay una tasa oficial vigente. Actualiza la tasa antes de registrar la venta.';
      return;
    }

    const payments: SalePaymentInput[] = [];
    if (values.payment_mode === 'immediate') {
      const session = this.openSessions.find((item) => String(item.id) === values.cash_session_id);
      if (!session) {
        this.formError = 'Selecciona una sesión de caja abierta para registrar el pago.';
        return;
      }
      if (session.currency !== 'VES') {
        this.formError = 'La venta se totaliza en VES; selecciona una sesión de caja en bolívares.';
        return;
      }
      payments.push({
        cash_session_id: session.id,
        payment_method: values.payment_method,
        amount: this.estimatedTotal()
      });
    }

    if (!window.confirm(`¿Confirmas registrar la venta por ${this.estimatedTotal()} VES?`)) {
      return;
    }

    this.saving = true;
    this.formError = '';
    this.#sales.create({
      customer_id: values.customer_id ? Number(values.customer_id) : null,
      payment_mode: values.payment_mode,
      price_list_id: priceList.id,
      inventory_location_id: Number(values.inventory_location_id),
      notes: values.notes.trim() || null,
      lines: values.lines.map((line) => ({
        product_id: Number(line.product_id),
        unit_id: line.unit_id ? Number(line.unit_id) : null,
        quantity: line.quantity
      })),
      ...(payments.length ? { payments } : {})
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: ({ data }) => {
          this.saleModalVisible = false;
          this.successMessage = `Venta #${data.id} registrada correctamente.`;
          this.load(1);
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  openPayment(sale: Sale): void {
    this.selectedSale = sale;
    this.formError = '';
    this.paymentForm.reset({
      cash_session_id: '',
      payment_method: 'cash',
      amount: this.remaining(sale),
      exchange_rate: ''
    });
    this.paymentModalVisible = true;
  }

  savePayment(): void {
    const sale = this.selectedSale;
    if (!sale || this.paymentForm.invalid || this.saving) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const values = this.paymentForm.getRawValue();
    const session = this.openSessions.find((item) => String(item.id) === values.cash_session_id);
    if (!session) {
      this.formError = 'Selecciona una sesión de caja abierta.';
      return;
    }
    if (session.currency !== sale.currency && !values.exchange_rate) {
      this.formError = `Indica cuántas unidades de ${sale.currency} corresponden a una unidad de ${session.currency}.`;
      return;
    }
    const body: SalePaymentInput = {
      cash_session_id: session.id,
      payment_method: values.payment_method,
      amount: values.amount,
      ...(session.currency !== sale.currency ? { exchange_rate: values.exchange_rate } : {})
    };

    this.saving = true;
    this.#sales.pay(sale.id, body)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.paymentModalVisible = false;
          this.successMessage = 'Abono registrado correctamente.';
          this.load();
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  remaining(sale: Sale): string {
    const paid = sumDecimals(sale.payments.map((payment) => payment.applied_amount));
    const balance = decimalToScaled(sale.total, 6) - decimalToScaled(paid, 6);
    return scaledToDecimal(balance > 0n ? balance : 0n, 6);
  }

  canReceivePayment(sale: Sale): boolean {
    return Boolean(sale.customer && this.remaining(sale) !== '0.000000');
  }

  openReceipt(sale: Sale): void {
    window.open(this.#sales.receiptUrl(sale.id), '_blank', 'noopener');
  }

  private priceForRawLine(line: { product_id: string; unit_id: string }): ProductPrice | undefined {
    const priceListId = Number(this.saleForm.controls.price_list_id.value);
    return (this.productPrices.get(Number(line.product_id)) ?? []).find((price) =>
      price.is_active &&
      price.price_list.id === priceListId &&
      (price.unit ? String(price.unit.id) : '') === line.unit_id
    );
  }

  private createLine(): SaleLineForm {
    return new FormGroup({
      product_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      unit_id: new FormControl('', { nonNullable: true }),
      quantity: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^(?=.*[1-9])\d+(\.\d{1,3})?$/)]
      })
    });
  }
}
