import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ChartData, ChartOptions } from 'chart.js';
import {
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  RowComponent
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { getStyle } from '@coreui/utils';
import { finalize } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { getApiErrorMessage } from '../../core/api-error';
import { DashboardWidgetMetric, WidgetsDropdownComponent } from '../widgets/widgets-dropdown/widgets-dropdown.component';

interface CurrencyAmount {
  currency: string;
  amount: string;
}

interface ReportSummary {
  sales: {
    count: number;
    total_by_currency: CurrencyAmount[];
    by_product: Array<{
      product_id: number;
      product: string | null;
      currency: string;
      quantity: string;
      total: string;
    }>;
  };
  purchases: { count: number; total_by_currency: CurrencyAmount[] };
  inventory: { stock_lines: number; value_by_currency: CurrencyAmount[] };
  accounts_receivable: { count: number; balance_by_currency: CurrencyAmount[] };
  accounts_payable: { count: number; balance_by_currency: CurrencyAmount[] };
}

interface ApiEnvelope<T> {
  data: T;
}

@Component({
  templateUrl: './dashboard.component.html',
  imports: [
    CardBodyComponent,
    CardComponent,
    CardHeaderComponent,
    ChartjsComponent,
    ColComponent,
    RouterLink,
    RowComponent,
    WidgetsDropdownComponent
  ]
})
export class DashboardComponent implements OnInit {
  readonly #api = inject(ApiService);
  readonly #destroyRef = inject(DestroyRef);

  readonly summary = signal<ReportSummary | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly widgetMetrics = signal<DashboardWidgetMetric[]>([]);
  readonly chartData = signal<ChartData<'bar'>>({
    labels: [],
    datasets: [{
      data: [],
      label: 'Ventas',
      backgroundColor: getStyle('--cui-primary') ?? '#321fdb'
    }]
  });

  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
    scales: { y: { beginAtZero: true } }
  };

  ngOnInit(): void {
    this.#api
      .get<ApiEnvelope<ReportSummary>>('reports/summary')
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: ({ data }) => {
          this.summary.set(data);
          this.widgetMetrics.set([
            this.widgetMetric(`Ventas (${data.sales.count})`, data.sales.total_by_currency, 'primary'),
            this.widgetMetric(`Compras (${data.purchases.count})`, data.purchases.total_by_currency, 'info'),
            this.widgetMetric('Valor del inventario', data.inventory.value_by_currency, 'success'),
            this.widgetMetric(`Por cobrar (${data.accounts_receivable.count})`, data.accounts_receivable.balance_by_currency, 'warning')
          ]);
          const products = [...data.sales.by_product]
            .sort((left, right) => Number(right.total) - Number(left.total))
            .slice(0, 8);
          const labels = products.map((product) =>
            product.product ?? `Producto ${product.product_id}`
          );
          const currencies = [...new Set(products.map((product) => product.currency))];
          this.chartData.set({
            labels,
            datasets: currencies.map((currency, index) => ({
              data: products.map((product) =>
                product.currency === currency ? Number(product.total) : 0
              ),
              label: `Ventas (${currency})`,
              backgroundColor: [
                getStyle('--cui-primary') ?? '#321fdb',
                getStyle('--cui-success') ?? '#2eb85c',
                getStyle('--cui-warning') ?? '#f9b115',
                getStyle('--cui-danger') ?? '#e55353'
              ][index % 4]
            }))
          });
        },
        error: (error: unknown) => this.errorMessage.set(getApiErrorMessage(error))
      });
  }

  formatAmounts(amounts: CurrencyAmount[] | undefined): string {
    if (!amounts?.length) {
      return '—';
    }

    return amounts
      .map(({ currency, amount }) =>
        `${currency} ${Number(amount).toLocaleString('es-VE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`
      )
      .join(' · ');
  }

  private widgetMetric(
    title: string,
    amounts: CurrencyAmount[],
    color: string
  ): DashboardWidgetMetric {
    return {
      title,
      value: this.formatAmounts(amounts),
      color,
      labels: amounts.map(({ currency }) => currency),
      values: amounts.map(({ amount }) => Number(amount))
    };
  }
}
