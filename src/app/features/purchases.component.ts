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
import { finalize, forkJoin } from 'rxjs';

import { getApiErrorMessage } from '../core/api-error';
import { CashSession, InventoryLocation, Product, Purchase, Supplier } from '../core/models/catalog.models';
import { CashService } from '../core/services/cash.service';
import { InventoryService } from '../core/services/inventory.service';
import { ProductService } from '../core/services/product.service';
import { PurchaseService } from '../core/services/purchase.service';
import { SalePaymentInput } from '../core/services/sale.service';
import { SupplierService } from '../core/services/supplier.service';
import { decimalToScaled, multiplyDecimalsToSix, scaledToDecimal, sumDecimals } from '../core/utils/decimal';

type PurchaseLineForm = FormGroup<{
  product_id: FormControl<string>;
  animal_count: FormControl<string>;
  weights: FormControl<string>;
  unit_cost: FormControl<string>;
}>;

@Component({
  selector: 'app-purchases',
  templateUrl: './purchases.component.html',
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
export class PurchasesComponent implements OnInit {
  readonly #destroyRef = inject(DestroyRef);
  readonly #purchases = inject(PurchaseService);
  readonly #suppliersApi = inject(SupplierService);
  readonly #productsApi = inject(ProductService);
  readonly #inventoryApi = inject(InventoryService);
  readonly #cashApi = inject(CashService);

  purchases: Purchase[] = [];
  suppliers: Supplier[] = [];
  products: Product[] = [];
  locations: InventoryLocation[] = [];
  openSessions: CashSession[] = [];
  loading = false;
  saving = false;
  page = 1;
  lastPage = 1;
  total = 0;
  pageError = '';
  formError = '';
  successMessage = '';
  purchaseModalVisible = false;
  paymentModalVisible = false;
  selectedPurchase: Purchase | null = null;
  readonly purchaseForm = new FormGroup({
    supplier_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    inventory_location_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    document_number: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(64)] }),
    currency: new FormControl({ value: 'USD', disabled: true }, {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    lines: new FormArray<PurchaseLineForm>([this.createLine()])
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

  get lines(): FormArray<PurchaseLineForm> {
    return this.purchaseForm.controls.lines;
  }

  load(page = this.page): void {
    this.loading = true;
    this.pageError = '';
    forkJoin({
      purchases: this.#purchases.list(page),
      suppliers: this.#suppliersApi.list(),
      products: this.#productsApi.list(),
      locations: this.#inventoryApi.locations(),
      sessions: this.#cashApi.sessions()
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (result) => {
          this.purchases = result.purchases.data;
          this.page = result.purchases.meta.current_page;
          this.lastPage = result.purchases.meta.last_page;
          this.total = result.purchases.meta.total;
          this.suppliers = result.suppliers.data;
          this.products = result.products.data;
          this.locations = result.locations.data;
          this.openSessions = result.sessions.data.filter((session) => session.status === 'open');
        },
        error: (error: unknown) => this.pageError = getApiErrorMessage(error)
      });
  }

  openPurchase(): void {
    this.formError = '';
    this.purchaseForm.reset({
      supplier_id: '',
      inventory_location_id: '',
      document_number: '',
      currency: 'USD',
      notes: ''
    });
    this.lines.clear();
    this.lines.push(this.createLine());
    this.purchaseModalVisible = true;
  }

  addLine(): void {
    this.lines.push(this.createLine());
  }

  removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  lineTotal(line: PurchaseLineForm): string {
    const quantity = this.lineQuantity(line);
    const unitCost = line.controls.unit_cost.value;
    return quantity && unitCost ? multiplyDecimalsToSix(quantity, unitCost) : '0.000000';
  }

  lineQuantity(line: PurchaseLineForm): string {
    const weights = this.parseWeights(line.controls.weights.value);
    return weights.length > 0 ? sumDecimals(weights, 3) : line.controls.animal_count.value;
  }

  parseWeights(value: string): string[] {
    return value.split(',').map((weight) => weight.trim()).filter(Boolean);
  }

  estimatedTotal(): string {
    return sumDecimals(this.lines.controls.map((line) => this.lineTotal(line)));
  }

  savePurchase(): void {
    if (this.purchaseForm.invalid || this.saving) {
      this.purchaseForm.markAllAsTouched();
      return;
    }
    const values = this.purchaseForm.getRawValue();
    if (values.currency !== 'USD') {
      this.formError = 'Las compras deben registrarse en USD.';
      return;
    }
    if (!values.lines.every((line) => line.product_id && line.animal_count && line.unit_cost)) {
      this.formError = 'Completa producto, cantidad y costo unitario en todas las líneas.';
      return;
    }
    for (const line of this.lines.controls) {
      const weights = this.parseWeights(line.controls.weights.value);
      if (weights.length > 0 && weights.length !== Number(line.controls.animal_count.value)) {
        this.formError = 'La cantidad de reses debe coincidir con la cantidad de pesos ingresados.';
        return;
      }
      if (weights.some((weight) => !/^(?=.*[1-9])\d+(\.\d{1,3})?$/.test(weight))) {
        this.formError = 'Cada peso debe ser válido y tener hasta tres decimales.';
        return;
      }
    }
    if (new Set(values.lines.map((line) => line.product_id)).size !== values.lines.length) {
      this.formError = 'Cada producto solo puede aparecer una vez en la compra.';
      return;
    }
    if (!window.confirm(`¿Confirmas recibir esta compra por ${this.estimatedTotal()} ${values.currency}?`)) {
      return;
    }

    this.saving = true;
    this.formError = '';
    this.#purchases.create({
      supplier_id: Number(values.supplier_id),
      inventory_location_id: Number(values.inventory_location_id),
      document_number: values.document_number.trim() || null,
      currency: values.currency,
      notes: values.notes.trim() || null,
      lines: values.lines.map((line, index) => ({
        product_id: Number(line.product_id),
        quantity: this.lineQuantity(this.lines.controls[index]),
        unit_cost: line.unit_cost,
        ...(this.parseWeights(line.weights).length > 0
          ? { units: this.parseWeights(line.weights).map((weight) => ({ weight })) }
          : {})
      }))
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: ({ data }) => {
          this.purchaseModalVisible = false;
          this.successMessage = `Compra #${data.id} recibida y agregada al inventario.`;
          this.load(1);
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  openPayment(purchase: Purchase): void {
    this.selectedPurchase = purchase;
    this.formError = '';
    this.paymentForm.reset({
      cash_session_id: '',
      payment_method: 'cash',
      amount: '',
      exchange_rate: ''
    });
    this.paymentModalVisible = true;
  }

  selectedPaymentSession(): CashSession | undefined {
    const sessionId = this.paymentForm.controls.cash_session_id.value;
    return this.openSessions.find((session) => String(session.id) === sessionId);
  }

  paymentRequiresExchangeRate(): boolean {
    const session = this.selectedPaymentSession();
    return Boolean(session && this.selectedPurchase && session.currency !== this.selectedPurchase.currency);
  }

  paymentAppliedAmount(): string {
    const amount = this.paymentForm.controls.amount.value;
    const rate = this.paymentForm.controls.exchange_rate.value;
    if (!amount) {
      return '0.000000';
    }
    return this.paymentRequiresExchangeRate() && rate
      ? multiplyDecimalsToSix(amount, rate)
      : scaledToDecimal(decimalToScaled(amount, 6), 6);
  }

  savePayment(): void {
    const purchase = this.selectedPurchase;
    if (!purchase || this.paymentForm.invalid || this.saving) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const values = this.paymentForm.getRawValue();
    const session = this.openSessions.find((item) => String(item.id) === values.cash_session_id);
    if (!session) {
      this.formError = 'Selecciona una sesión de caja abierta.';
      return;
    }
    if (session.currency !== purchase.currency && !values.exchange_rate) {
      this.formError = `Indica cuántas unidades de ${purchase.currency} corresponden a una unidad de ${session.currency}.`;
      return;
    }
    if (!window.confirm(`¿Confirmas registrar el pago de ${values.amount} ${session.currency}?`)) {
      return;
    }

    const body: SalePaymentInput = {
      cash_session_id: session.id,
      payment_method: values.payment_method,
      amount: values.amount,
      ...(session.currency !== purchase.currency ? { exchange_rate: values.exchange_rate } : {})
    };
    this.saving = true;
    this.#purchases.pay(purchase.id, body)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.paymentModalVisible = false;
          this.successMessage = 'Pago a proveedor registrado correctamente.';
          this.load();
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  remaining(purchase: Purchase): string {
    const applied = sumDecimals(purchase.payments.map((payment) => payment.applied_amount));
    const remaining = decimalToScaled(purchase.total, 6) - decimalToScaled(applied, 6);
    return scaledToDecimal(remaining > 0n ? remaining : 0n, 6);
  }

  private createLine(): PurchaseLineForm {
    return new FormGroup({
      product_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      animal_count: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^(?=.*[1-9])\d+$/)]
      }),
      weights: new FormControl('', {
        nonNullable: true
      }),
      unit_cost: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^(?=.*[1-9])\d+(\.\d{1,6})?$/)]
      })
    });
  }
}
