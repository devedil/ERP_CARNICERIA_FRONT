import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import {
  ButtonDirective,
  ButtonCloseDirective,
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
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { getStyle } from '@coreui/utils';
import { EMPTY, Observable, expand, finalize, forkJoin, reduce } from 'rxjs';

import { getApiErrorMessage } from '../core/api-error';
import {
  InventoryItem,
  InventoryLocation,
  InventoryProcessing,
  Product,
  ProductPrice
} from '../core/models/catalog.models';
import { InventoryService } from '../core/services/inventory.service';
import { ProductService } from '../core/services/product.service';
import { divideDecimalsToSix, multiplyDecimalsToSix, sumDecimals } from '../core/utils/decimal';

interface CattleRecord {
  key: string;
  status: 'pending_processing' | 'processed';
  identifier: string;
  productId: number;
  productName: string;
  locationId: number;
  locationName: string;
  weight: string;
  cost: string | null;
  currency: string | null;
  receivedAt: string;
  processedAt: string | null;
  supplier: string;
  purchase: string;
  waste: string;
  outputs: InventoryProcessing['outputs'];
}

@Component({
  templateUrl: './cattle-control.component.html',
  imports: [
    ButtonDirective,
    ButtonCloseDirective,
    CardBodyComponent,
    CardComponent,
    CardHeaderComponent,
    ChartjsComponent,
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
export class CattleControlComponent implements OnInit {
  readonly #destroyRef = inject(DestroyRef);
  readonly #changeDetector = inject(ChangeDetectorRef);
  readonly #inventory = inject(InventoryService);
  readonly #products = inject(ProductService);

  readonly filters = new FormGroup({
    from: new FormControl('', { nonNullable: true }),
    to: new FormControl('', { nonNullable: true }),
    locationId: new FormControl('', { nonNullable: true }),
    supplier: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true })
  });
  locations: InventoryLocation[] = [];
  products: Product[] = [];
  records: CattleRecord[] = [];
  filteredRecords: CattleRecord[] = [];
  selectedRecord: CattleRecord | null = null;
  loading = false;
  pricesLoading = false;
  pageError = '';
  priceError = '';
  filterError = '';
  detailsVisible = false;
  private pricesLoaded = false;
  private readonly retailPrices = new Map<number, ProductPrice>();
  chartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  readonly chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.pageError = '';
    this.priceError = '';
    forkJoin({
      locations: this.#inventory.locations(),
      products: this.#products.list(),
      processings: this.loadAllProcessings(),
      items: this.loadAllPendingItems()
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.loading = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: ({ locations, products, processings, items }) => {
          this.locations = locations.data;
          this.products = products.data;
          this.records = this.toRecords(processings, items);
          this.applyFilters();
          this.loadRetailPrices(processings);
        },
        error: (error: unknown) => {
          this.pageError = getApiErrorMessage(error);
          this.#changeDetector.markForCheck();
        }
      });
  }

  applyFilters(): void {
    const values = this.filters.getRawValue();
    if (values.from && values.to && values.from > values.to) {
      this.filterError = 'La fecha inicial no puede ser posterior a la fecha final.';
      return;
    }

    this.filterError = '';
    this.filteredRecords = this.records.filter((record) => {
      const date = record.receivedAt.slice(0, 10);
      return (!values.from || date >= values.from) &&
        (!values.to || date <= values.to) &&
        (!values.locationId || record.locationId === Number(values.locationId)) &&
        (!values.supplier || record.supplier === values.supplier) &&
        (!values.status || record.status === values.status);
    });
    this.updateChart();
  }

  clearFilters(): void {
    this.filters.reset({ from: '', to: '', locationId: '', supplier: '', status: '' });
    this.applyFilters();
  }

  get suppliers(): string[] {
    return [...new Set(this.records.map((record) => record.supplier).filter(Boolean))].sort();
  }

  get pendingCount(): number {
    return this.filteredRecords.filter((record) => record.status === 'pending_processing').length;
  }

  get processedCount(): number {
    return this.filteredRecords.filter((record) => record.status === 'processed').length;
  }

  get processedCost(): string | null {
    const processed = this.filteredRecords.filter((record) => record.status === 'processed');
    if (processed.some((record) => record.currency !== 'USD' || record.cost === null)) return null;
    return sumDecimals(processed.map((record) => record.cost ?? '0.000000'));
  }

  get estimatedRevenue(): string | null {
    if (!this.pricesLoaded) return null;
    const processed = this.filteredRecords.filter((record) => record.status === 'processed');
    const revenues = processed.map((record) => this.recordRevenue(record));
    if (revenues.some((revenue) => revenue === null)) return null;
    return sumDecimals(revenues.filter((revenue): revenue is string => revenue !== null));
  }

  get estimatedProfit(): string | null {
    const revenue = this.estimatedRevenue;
    const cost = this.processedCost;
    if (revenue === null || cost === null) return null;
    return sumDecimals([revenue, `-${cost}`]);
  }

  get estimatedMargin(): string {
    const revenue = this.estimatedRevenue;
    const profit = this.estimatedProfit;
    return revenue === null || profit === null || revenue === '0.000000'
      ? '—'
      : `${this.percent(profit, revenue)}%`;
  }

  get estimatedReturn(): string {
    const profit = this.estimatedProfit;
    return profit === null || this.processedCost === null || this.processedCost === '0.000000'
      ? '—'
      : `${this.percent(profit, this.processedCost)}%`;
  }

  selectRecord(record: CattleRecord): void {
    this.selectedRecord = record;
    this.detailsVisible = true;
  }

  recordRevenue(record: CattleRecord): string | null {
    if (record.outputs.some((output) => !this.retailPrices.has(output.product_id))) return null;
    return sumDecimals(record.outputs.map((output) => {
      const price = this.retailPrices.get(output.product_id);
      return price ? multiplyDecimalsToSix(output.quantity, price.amount) : '0.000000';
    }));
  }

  recordProfit(record: CattleRecord): string | null {
    const revenue = this.recordRevenue(record);
    return revenue === null || record.currency !== 'USD' || record.cost === null
      ? null
      : sumDecimals([revenue, `-${record.cost}`]);
  }

  recordMargin(record: CattleRecord): string {
    const revenue = this.recordRevenue(record);
    const profit = this.recordProfit(record);
    if (revenue === null || profit === null || record.cost === null || revenue === '0.000000') {
      return '—';
    }
    return `${this.percent(profit, revenue)}% / ${this.percent(profit, record.cost)}%`;
  }

  formatOptionalMoney(amount: string | null, currency: string | null = 'USD'): string {
    return amount === null ? '—' : this.formatMoney(amount, currency ?? 'Moneda desconocida');
  }

  outputRevenue(output: InventoryProcessing['outputs'][number]): string {
    const price = this.retailPrices.get(output.product_id);
    return price ? multiplyDecimalsToSix(output.quantity, price.amount) : '—';
  }

  outputPrice(output: InventoryProcessing['outputs'][number]): string {
    return this.retailPrices.get(output.product_id)?.amount ?? '—';
  }

  outputTotal(record: CattleRecord): string {
    return sumDecimals(record.outputs.map((output) => output.quantity), 3);
  }

  outputName(productId: number): string {
    return this.products.find((product) => product.id === productId)?.name ?? `Producto #${productId}`;
  }

  outputUnit(productId: number): string {
    return this.products.find((product) => product.id === productId)?.base_unit ?? 'kg';
  }

  yieldPercent(record: CattleRecord): string {
    return this.percent(sumDecimals(record.outputs.map((output) => output.quantity)), record.weight);
  }

  wastePercent(record: CattleRecord): string {
    return this.percent(record.waste, record.weight);
  }

  formatMoney(amount: string, currency = 'USD'): string {
    return `${currency} ${Number(amount).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  formatQuantity(amount: string): string {
    return Number(amount).toLocaleString('es-VE', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    });
  }

  formatDate(date: string): string {
    if (!date) return '—';
    const parsedDate = new Date(date);
    return Number.isNaN(parsedDate.getTime())
      ? date
      : parsedDate.toLocaleDateString('es-VE');
  }

  private loadAllProcessings(): Observable<InventoryProcessing[]> {
    return this.#inventory.processings(1).pipe(
      expand((response) =>
        response.meta.current_page < response.meta.last_page
          ? this.#inventory.processings(response.meta.current_page + 1)
          : EMPTY
      ),
      reduce((all, response) => all.concat(response.data), [] as InventoryProcessing[])
    );
  }

  private loadAllPendingItems(): Observable<InventoryItem[]> {
    return this.#inventory.items(undefined, undefined, 1).pipe(
      expand((response) =>
        response.meta.current_page < response.meta.last_page
          ? this.#inventory.items(undefined, undefined, response.meta.current_page + 1)
          : EMPTY
      ),
      reduce((all, response) => all.concat(response.data), [] as InventoryItem[])
    );
  }

  private toRecords(processings: InventoryProcessing[], items: InventoryItem[]): CattleRecord[] {
    const processed = processings.map((processing): CattleRecord => {
      const sourceItem = processing.source_item;
      const purchase = sourceItem?.purchase;
      const product = this.products.find((entry) => entry.id === processing.source_product_id);
      const location = this.locations.find((entry) => entry.id === processing.inventory_location_id);
      return {
        key: `processing-${processing.id}`,
        status: 'processed',
        identifier: sourceItem?.identifier ?? `Desposte #${processing.id}`,
        productId: processing.source_product_id,
        productName: product?.name ?? `Producto #${processing.source_product_id}`,
        locationId: processing.inventory_location_id,
        locationName: location?.name ?? `Almacén #${processing.inventory_location_id}`,
        weight: processing.source_quantity,
        cost: processing.total_cost,
        currency: processing.cost_currency,
        receivedAt: purchase?.received_at ?? processing.created_at,
        processedAt: processing.created_at,
        supplier: purchase?.supplier?.name ?? '',
        purchase: purchase?.document_number || (purchase ? `Compra #${purchase.id}` : ''),
        waste: processing.waste_quantity,
        outputs: processing.outputs
      };
    });
    const pending = items.map((item): CattleRecord => ({
      key: `item-${item.id}`,
      status: 'pending_processing',
      identifier: item.identifier,
      productId: item.product.id,
      productName: item.product.name,
      locationId: item.location.id,
      locationName: item.location.name,
      weight: item.weight,
      cost: item.total_cost,
      currency: item.cost_currency,
      receivedAt: item.purchase?.received_at ?? '',
      processedAt: null,
      supplier: item.purchase?.supplier?.name ?? '',
      purchase: item.purchase?.document_number || (item.purchase ? `Compra #${item.purchase.id}` : ''),
      waste: '0.000',
      outputs: []
    }));
    return [...pending, ...processed].sort((left, right) =>
      right.receivedAt.localeCompare(left.receivedAt)
    );
  }

  private loadRetailPrices(processings: InventoryProcessing[]): void {
    const productIds = [...new Set(processings.flatMap((processing) =>
      processing.outputs.map((output) => output.product_id)
    ))];
    this.retailPrices.clear();
    this.pricesLoaded = false;
    if (!productIds.length) {
      this.pricesLoaded = true;
      this.updateChart();
      return;
    }

    this.pricesLoading = true;
    forkJoin(productIds.map((id) => this.#products.prices(id)))
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.pricesLoading = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: (responses) => {
          responses.forEach((response, index) => {
            const price = response.data.find((entry) =>
              entry.is_active &&
              entry.unit === null &&
              entry.price_list.code === 'retail' &&
              entry.price_list.currency === 'USD'
            );
            if (price) this.retailPrices.set(productIds[index], price);
          });
          if (productIds.some((id) => !this.retailPrices.has(id))) {
            this.priceError = 'Algunos subproductos no tienen un Precio Detal USD activo; no se muestra una estimación total incompleta.';
          }
          this.pricesLoaded = true;
          this.updateChart();
        },
        error: (error: unknown) => {
          this.priceError = `No se pudieron consultar los precios Detal USD: ${getApiErrorMessage(error)}`;
          this.#changeDetector.markForCheck();
        }
      });
  }

  private updateChart(): void {
    if (!this.pricesLoaded || this.filteredRecords.some((record) =>
      record.status === 'processed' && this.recordRevenue(record) === null
    )) {
      this.chartData = { labels: [], datasets: [] };
      this.#changeDetector.markForCheck();
      return;
    }

    const totals = new Map<number, string>();
    for (const record of this.filteredRecords) {
      if (record.status !== 'processed') continue;
      for (const output of record.outputs) {
        const price = this.retailPrices.get(output.product_id);
        if (!price) continue;
        const amount = multiplyDecimalsToSix(output.quantity, price.amount);
        totals.set(output.product_id, sumDecimals([totals.get(output.product_id) ?? '0.000000', amount]));
      }
    }

    const sorted = [...totals.entries()].sort((left, right) => Number(right[1]) - Number(left[1]));
    this.chartData = {
      labels: sorted.map(([id]) => this.outputName(id)),
      datasets: [{
        data: sorted.map(([, amount]) => Number(amount)),
        backgroundColor: sorted.map((_, index) =>
          [
            getStyle('--cui-primary') ?? '#7a1428',
            getStyle('--cui-info') ?? '#b98522',
            getStyle('--cui-success') ?? '#2eb85c',
            getStyle('--cui-warning') ?? '#f9b115',
            getStyle('--cui-danger') ?? '#e55353'
          ][index % 5]
        )
      }]
    };
    this.#changeDetector.markForCheck();
  }

  percent(numerator: string, denominator: string): string {
    if (denominator === '0.000' || denominator === '0.000000' || denominator === '0') return '0.00';
    return (Number(divideDecimalsToSix(numerator, denominator)) * 100)
      .toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
