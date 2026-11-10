import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ChartData, ChartOptions } from 'chart.js';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  FormSelectDirective,
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { getStyle } from '@coreui/utils';
import { finalize, forkJoin } from 'rxjs';

import { getApiErrorMessage } from '../core/api-error';
import { InventoryLocation } from '../core/models/catalog.models';
import { InventoryService } from '../core/services/inventory.service';
import { ReportCurrencyAmount, ReportService, ReportSummary } from '../core/services/report.service';

@Component({
  templateUrl: './reports.component.html',
  imports: [
    ButtonDirective,
    CardBodyComponent,
    CardComponent,
    CardHeaderComponent,
    ChartjsComponent,
    ColComponent,
    FormControlDirective,
    FormDirective,
    FormLabelDirective,
    FormSelectDirective,
    ReactiveFormsModule,
    RowComponent,
    TableDirective
  ]
})
export class ReportsComponent implements OnInit {
  readonly #destroyRef = inject(DestroyRef);
  readonly #changeDetector = inject(ChangeDetectorRef);
  readonly #reports = inject(ReportService);
  readonly #inventory = inject(InventoryService);

  readonly filters = new FormGroup({
    from: new FormControl(this.monthStart(), { nonNullable: true }),
    to: new FormControl(this.today(), { nonNullable: true }),
    currency: new FormControl('', { nonNullable: true }),
    inventory_location_id: new FormControl('', { nonNullable: true })
  });
  locations: InventoryLocation[] = [];
  summary: ReportSummary | null = null;
  loading = false;
  pageError = '';
  filterError = '';
  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
    scales: { y: { beginAtZero: true } }
  };
  chartData: ChartData<'bar'> = { labels: [], datasets: [] };

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      locations: this.#inventory.locations(),
      report: this.#reports.summary({
        from: this.filters.controls.from.value,
        to: this.filters.controls.to.value
      })
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.loading = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: ({ locations, report }) => {
          this.locations = locations.data;
          this.setSummary(report.data);
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
    this.pageError = '';
    this.loading = true;
    this.#reports.summary({
      from: values.from || undefined,
      to: values.to || undefined,
      currency: values.currency || undefined,
      inventoryLocationId: values.inventory_location_id
        ? Number(values.inventory_location_id)
        : undefined
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.loading = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: ({ data }) => this.setSummary(data),
        error: (error: unknown) => {
          this.pageError = getApiErrorMessage(error);
          this.#changeDetector.markForCheck();
        }
      });
  }

  formatAmounts(amounts: ReportCurrencyAmount[] | undefined): string {
    if (!amounts?.length) {
      return '—';
    }

    return amounts.map(({ currency, amount }) =>
      `${currency} ${Number(amount).toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`
    ).join(' · ');
  }

  formatAmount(amount: string, currency: string): string {
    return `${currency} ${Number(amount).toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  private setSummary(summary: ReportSummary): void {
    this.summary = summary;
    const products = [...summary.sales.by_product]
      .sort((left, right) => Number(right.total) - Number(left.total))
      .slice(0, 10);
    const currencies = [...new Set(products.map((product) => product.currency))];
    const labels = [...new Set(products.map((product) => product.product ?? `Producto ${product.product_id}`))];
    this.chartData = {
      labels,
      datasets: currencies.map((currency, index) => ({
        label: `Ventas (${currency})`,
        data: labels.map((label) => {
            const product = products.find((item) =>
              (item.product ?? `Producto ${item.product_id}`) === label && item.currency === currency
            );
            return product ? Number(product.total) : 0;
          }),
        backgroundColor: [
          getStyle('--cui-primary') ?? '#321fdb',
          getStyle('--cui-success') ?? '#2eb85c',
          getStyle('--cui-warning') ?? '#f9b115',
          getStyle('--cui-info') ?? '#39f'
        ][index % 4]
      }))
    };
    this.#changeDetector.markForCheck();
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private monthStart(): string {
    return `${this.today().slice(0, 7)}-01`;
  }
}
