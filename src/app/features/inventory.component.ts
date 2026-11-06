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
import {
  InventoryLocation,
  InventoryMovement,
  InventoryProcessing,
  ProductPrice,
  InventoryItem,
  InventoryStock,
  InventoryTransfer,
  InventoryValuation,
  Product
} from '../core/models/catalog.models';
import { InventoryService } from '../core/services/inventory.service';
import { ProductService } from '../core/services/product.service';
import { decimalToScaled, multiplyDecimalsToSix, scaledToDecimal, sumDecimals } from '../core/utils/decimal';

type ProcessingOutputForm = FormGroup<{
  product_id: FormControl<string>;
  quantity: FormControl<string>;
}>;

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
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
export class InventoryComponent implements OnInit {
  readonly #destroyRef = inject(DestroyRef);
  readonly #inventory = inject(InventoryService);
  readonly #products = inject(ProductService);

  products: Product[] = [];
  locations: InventoryLocation[] = [];
  stocks: InventoryStock[] = [];
  movements: InventoryMovement[] = [];
  processings: InventoryProcessing[] = [];
  transfers: InventoryTransfer[] = [];
  inventoryItems: InventoryItem[] = [];
  readonly productPrices = new Map<number, ProductPrice[]>();
  valuation: InventoryValuation[] = [];
  loading = false;
  productPricesLoading = false;
  saving = false;
  pageError = '';
  formError = '';
  successMessage = '';
  stockPage = 1;
  stockLastPage = 1;
  stockTotal = 0;
  movementPage = 1;
  movementLastPage = 1;
  adjustmentModalVisible = false;
  transferModalVisible = false;
  processingModalVisible = false;
  lowStockOnly = false;
  productFilter = '';
  locationFilter = '';
  readonly adjustmentForm = new FormGroup({
    product_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    inventory_location_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^-?(?=.*[1-9])\d+(\.\d{1,3})?$/)]
    }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    unit_cost: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^\d+(\.\d{1,6})?$/)]
    }),
    cost_currency: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^[A-Z]{3}$/)]
    })
  });
  readonly transferForm = new FormGroup({
    product_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    source_location_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    destination_location_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(?=.*[1-9])\d+(\.\d{1,3})?$/)]
    }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] })
  });
  readonly processingForm = new FormGroup({
    source_inventory_item_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    source_product_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    inventory_location_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    source_quantity: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(?=.*[1-9])\d+(\.\d{1,3})?$/)]
    }),
    waste_quantity: new FormControl('0', {
      nonNullable: true,
      validators: [Validators.pattern(/^\d+(\.\d{1,3})?$/)]
    }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] }),
    outputs: new FormArray<ProcessingOutputForm>([this.createProcessingOutput()])
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.pageError = '';
    forkJoin({
      products: this.#products.list(),
      locations: this.#inventory.locations(),
      stocks: this.#inventory.stocks(this.filters(this.stockPage)),
      movements: this.#inventory.movements(this.filters(this.movementPage)),
      transfers: this.#inventory.transfers(),
      items: this.#inventory.items(),
      processings: this.#inventory.processings(),
      valuation: this.#inventory.valuation(this.locationFilter ? Number(this.locationFilter) : undefined)
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (result) => {
          this.products = result.products.data;
          this.loadProductPrices();
          this.locations = result.locations.data;
          this.stocks = result.stocks.data;
          this.stockPage = result.stocks.meta.current_page;
          this.stockLastPage = result.stocks.meta.last_page;
          this.stockTotal = result.stocks.meta.total;
          this.movements = result.movements.data;
          this.movementPage = result.movements.meta.current_page;
          this.movementLastPage = result.movements.meta.last_page;
          this.transfers = result.transfers.data;
          this.inventoryItems = result.items.data;
          this.processings = result.processings.data;
          this.valuation = result.valuation.data;
        },
        error: (error: unknown) => this.pageError = getApiErrorMessage(error)
      });
  }

  private loadProductPrices(): void {
    this.productPrices.clear();
    if (!this.products.length) {
      this.productPricesLoading = false;
      return;
    }

    this.productPricesLoading = true;
    forkJoin(this.products.map((product) => this.#products.prices(product.id)))
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.productPricesLoading = false)
      )
      .subscribe({
        next: (responses) => responses.forEach((response, index) => {
          this.productPrices.set(this.products[index].id, response.data);
        }),
        error: (error: unknown) => this.pageError = getApiErrorMessage(error)
      });
  }

  applyFilters(): void {
    this.stockPage = 1;
    this.movementPage = 1;
    this.load();
  }

  setLowStockOnly(event: Event): void {
    this.lowStockOnly = (event.target as HTMLInputElement).checked;
    this.applyFilters();
  }

  setProductFilter(event: Event): void {
    this.productFilter = (event.target as HTMLSelectElement).value;
  }

  setLocationFilter(event: Event): void {
    this.locationFilter = (event.target as HTMLSelectElement).value;
  }

  isLowStock(stock: InventoryStock): boolean {
    const product = this.products.find((item) => item.id === stock.product_id);
    return Boolean(product && Number(stock.quantity) < Number(product.minimum_stock));
  }

  changeStockPage(page: number): void {
    this.stockPage = page;
    this.load();
  }

  changeMovementPage(page: number): void {
    this.movementPage = page;
    this.load();
  }

  openAdjustment(): void {
    this.formError = '';
    this.adjustmentForm.reset({
      product_id: '',
      inventory_location_id: '',
      quantity: '',
      reason: '',
      unit_cost: '',
      cost_currency: ''
    });
    this.adjustmentModalVisible = true;
  }

  saveAdjustment(): void {
    if (this.adjustmentForm.invalid || this.saving) {
      this.adjustmentForm.markAllAsTouched();
      return;
    }

    const values = this.adjustmentForm.getRawValue();
    if (!window.confirm('¿Confirmas aplicar este ajuste al inventario?')) {
      return;
    }

    const body: {
      inventory_location_id: number;
      quantity: string;
      reason: string;
      unit_cost?: string;
      cost_currency?: string;
    } = {
      inventory_location_id: Number(values.inventory_location_id),
      quantity: values.quantity,
      reason: values.reason.trim()
    };
    if (values.unit_cost) {
      body.unit_cost = values.unit_cost;
    }
    if (values.cost_currency) {
      body.cost_currency = values.cost_currency;
    }

    this.saving = true;
    this.formError = '';
    this.#inventory.adjust(Number(values.product_id), body)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.adjustmentModalVisible = false;
          this.successMessage = 'Ajuste de inventario registrado correctamente.';
          this.applyFilters();
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  openTransfer(): void {
    this.formError = '';
    this.transferForm.reset({
      product_id: '',
      source_location_id: '',
      destination_location_id: '',
      quantity: '',
      reason: ''
    });
    this.transferModalVisible = true;
  }

  saveTransfer(): void {
    if (this.transferForm.invalid || this.saving) {
      this.transferForm.markAllAsTouched();
      return;
    }

    const values = this.transferForm.getRawValue();
    if (values.source_location_id === values.destination_location_id) {
      this.formError = 'El almacén de origen y destino deben ser diferentes.';
      return;
    }
    if (!window.confirm('¿Confirmas transferir esta cantidad entre almacenes?')) {
      return;
    }

    this.saving = true;
    this.formError = '';
    this.#inventory.transfer(Number(values.product_id), {
      source_location_id: Number(values.source_location_id),
      destination_location_id: Number(values.destination_location_id),
      quantity: values.quantity,
      reason: values.reason.trim()
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.transferModalVisible = false;
          this.successMessage = 'Transferencia de inventario registrada correctamente.';
          this.applyFilters();
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  openProcessing(): void {
    this.formError = '';
    this.processingForm.controls.source_product_id.enable();
    this.processingForm.controls.inventory_location_id.enable();
    this.processingForm.controls.source_quantity.enable();
    this.processingForm.reset({
      source_product_id: '',
      source_inventory_item_id: '',
      inventory_location_id: '',
      source_quantity: '',
      waste_quantity: '0',
      reason: ''
    });
    this.processingForm.controls.outputs.clear();
    this.processingForm.controls.outputs.push(this.createProcessingOutput());
    this.processingModalVisible = true;
  }

  selectProcessingItem(): void {
    const item = this.inventoryItems.find((candidate) =>
      String(candidate.id) === this.processingForm.controls.source_inventory_item_id.value
    );
    if (!item) {
      return;
    }
    this.processingForm.patchValue({
      source_product_id: String(item.product.id),
      inventory_location_id: String(item.location.id),
      source_quantity: item.remaining_weight
    });
    this.processingForm.controls.source_product_id.disable();
    this.processingForm.controls.inventory_location_id.disable();
    this.processingForm.controls.source_quantity.disable();
  }

  addProcessingOutput(): void {
    this.processingForm.controls.outputs.push(this.createProcessingOutput());
  }

  removeProcessingOutput(index: number): void {
    if (this.processingForm.controls.outputs.length > 1) {
      this.processingForm.controls.outputs.removeAt(index);
    }
  }

  processingShareTotal(): string {
    const values = this.processingForm.getRawValue();
    const commercialValues = values.outputs.map((output) => {
      const price = this.retailPrice(Number(output.product_id));
      return price ? multiplyDecimalsToSix(output.quantity, price.amount) : '0.000000';
    });
    const total = sumDecimals(commercialValues);
    return total === '0.000000' ? '0.0000' : '100.0000';
  }

  outputCostShare(index: number): string {
    const values = this.processingForm.getRawValue();
    const price = this.retailPrice(Number(values.outputs[index]?.product_id));
    const value = price
      ? multiplyDecimalsToSix(values.outputs[index]?.quantity ?? '0', price.amount)
      : '0.000000';
    const total = sumDecimals(values.outputs.map((output) => {
      const outputPrice = this.retailPrice(Number(output.product_id));
      return outputPrice ? multiplyDecimalsToSix(output.quantity, outputPrice.amount) : '0.000000';
    }));
    if (total === '0.000000') {
      return '0.00';
    }
    return (Number(value) / Number(total) * 100).toFixed(2);
  }

  physicalDifference(): string {
    const values = this.processingForm.getRawValue();
    const totalOutputs = sumDecimals(values.outputs.map((output) => output.quantity), 3);
    const total = decimalToScaled(values.source_quantity || '0', 3) -
      decimalToScaled(totalOutputs, 3) -
      decimalToScaled(values.waste_quantity || '0', 3);
    return scaledToDecimal(total, 3);
  }

  processingPricesReady(): boolean {
    const outputs = this.processingForm.getRawValue().outputs;
    return !this.productPricesLoading &&
      outputs.length > 0 &&
      outputs.every((output) => Boolean(this.retailPrice(Number(output.product_id))));
  }

  retailPrice(productId: number): ProductPrice | undefined {
    return (this.productPrices.get(productId) ?? []).find((price) =>
      price.is_active &&
      price.unit === null &&
      price.price_list.code === 'retail' &&
      price.price_list.currency === 'USD'
    );
  }

  retailPriceForValue(productId: string | undefined): ProductPrice | undefined {
    return productId ? this.retailPrice(Number(productId)) : undefined;
  }

  saveProcessing(): void {
    if (this.processingForm.invalid || this.saving) {
      this.processingForm.markAllAsTouched();
      return;
    }
    if (this.physicalDifference() !== '0.000') {
      this.formError = 'Los kilogramos de subproductos más merma deben coincidir exactamente con los kilogramos de origen.';
      return;
    }
    if (!this.processingPricesReady()) {
      this.formError = 'Cada subproducto debe tener un Precio Detal USD activo antes de registrar el desposte.';
      return;
    }

    const values = this.processingForm.getRawValue();
    const outputIds = values.outputs.map((output) => output.product_id);
    if (new Set(outputIds).size !== outputIds.length) {
      this.formError = 'Cada subproducto debe ser diferente y solo puede agregarse una vez.';
      return;
    }
    if (outputIds.includes(values.source_product_id)) {
      this.formError = 'El producto de origen no puede repetirse como subproducto.';
      return;
    }
    if (!window.confirm('¿Confirmas registrar el desposte y actualizar las existencias?')) {
      return;
    }

    this.saving = true;
    this.formError = '';
    this.#inventory.process({
      source_product_id: Number(values.source_product_id),
      source_inventory_item_id: Number(values.source_inventory_item_id),
      inventory_location_id: Number(values.inventory_location_id),
      source_quantity: values.source_quantity,
      waste_quantity: values.waste_quantity || '0',
      reason: values.reason.trim(),
      outputs: values.outputs.map((output) => ({
        product_id: Number(output.product_id),
        quantity: output.quantity
      }))
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.processingModalVisible = false;
          this.successMessage = 'Desposte registrado correctamente.';
          this.applyFilters();
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  productName(id: number): string {
    return this.products.find((product) => product.id === id)?.name ?? `Producto #${id}`;
  }

  locationName(id: number): string {
    return this.locations.find((location) => location.id === id)?.name ?? `Almacén #${id}`;
  }

  inventoryItemLabel(item: InventoryItem): string {
    const purchase = item.purchase;
    const purchaseLabel = purchase
      ? ` · Compra ${purchase.document_number || `#${purchase.id}`}`
      : '';
    return `${item.identifier} · ${item.product.name} · ${item.remaining_weight} kg · ${item.location.name}${purchaseLabel}`;
  }

  private filters(page: number): {
    productId?: number;
    locationId?: number;
    lowStock?: boolean;
    page: number;
  } {
    return {
      ...(this.productFilter ? { productId: Number(this.productFilter) } : {}),
      ...(this.locationFilter ? { locationId: Number(this.locationFilter) } : {}),
      ...(this.lowStockOnly ? { lowStock: true } : {}),
      page
    };
  }

  private createProcessingOutput(): ProcessingOutputForm {
    return new FormGroup({
      product_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      quantity: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^(?=.*[1-9])\d+(\.\d{1,3})?$/)]
      })
    });
  }

}
