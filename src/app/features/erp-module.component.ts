import { HttpParams } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { finalize, forkJoin, Subscription } from 'rxjs';

import { ApiService } from '../core/api.service';
import { getApiErrorMessage } from '../core/api-error';
import { PriceList } from '../core/models/catalog.models';
import { PriceListService } from '../core/services/price-list.service';
import { ErpColumn, ErpField, ErpModuleConfig, ErpOption } from './erp-module.config';

type ModuleRow = Record<string, unknown>;

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

@Component({
  selector: 'app-erp-module',
  templateUrl: './erp-module.component.html',
  imports: [
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
    ButtonCloseDirective,
    ReactiveFormsModule,
    RouterLink,
    RowComponent,
    TableDirective
  ]
})
export class ErpModuleComponent implements OnInit {
  readonly #route = inject(ActivatedRoute);
  readonly #api = inject(ApiService);
  readonly #priceListsApi = inject(PriceListService);
  readonly #destroyRef = inject(DestroyRef);

  readonly config = signal<ErpModuleConfig | null>(null);
  readonly rows = signal<ModuleRow[]>([]);
  readonly searchTerm = signal('');
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly currentPage = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly formVisible = signal(false);
  readonly selectedRow = signal<ModuleRow | null>(null);
  readonly saving = signal(false);
  readonly actionId = signal<number | null>(null);
  readonly showInactive = signal(false);
  readonly successMessage = signal('');
  readonly formError = signal('');
  readonly categoryOptionsLoading = signal(false);
  readonly categoryOptionsError = signal('');
  readonly categoryOptionsLoaded = signal(false);
  readonly productPriceLists = signal<PriceList[]>([]);
  readonly productPriceListsLoading = signal(false);
  readonly productPriceListsError = signal('');
  readonly availableFormFields = signal<ErpField[]>([]);
  readonly activeFormFields = signal<ErpField[]>([]);
  form = new FormGroup<Record<string, FormControl<string>>>({});
  #request?: Subscription;

  ngOnInit(): void {
    this.#route.data.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((data) => {
      const config = data['module'] as ErpModuleConfig;
      this.config.set(config);
      this.formVisible.set(false);
      this.selectedRow.set(null);
      this.activeFormFields.set([]);
      this.form = new FormGroup<Record<string, FormControl<string>>>({});
      this.availableFormFields.set(config.fields ?? []);
      this.searchTerm.set('');
      this.showInactive.set(false);
      this.successMessage.set('');
      this.categoryOptionsError.set('');
      this.categoryOptionsLoaded.set(false);
      this.productPriceListsError.set('');
      this.load(1);
      if (config.fields?.some((field) => field.key === 'category_id')) {
        this.loadCategoryOptions(config);
      }
      if (config.endpoint === 'products') {
        this.loadProductPriceLists();
      }
    });
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  search(): void {
    this.load(1);
  }

  get manageable(): boolean {
    return Boolean(this.config()?.fields?.length);
  }

  get formFields(): ErpField[] {
    if (this.formVisible() && this.activeFormFields().length) {
      return this.activeFormFields();
    }

    return this.availableFormFields();
  }

  private fieldsFor(row: ModuleRow | null): ErpField[] {
    const config = this.config();
    const fields = config?.fields ?? [];
    if (config?.endpoint !== 'products' || row) {
      return fields;
    }

    return this.availableFormFields();
  }

  private buildProductFields(fields: ErpField[]): ErpField[] {
    return [
      ...fields,
      ...this.productPriceLists().map((priceList): ErpField => ({
        key: `price_${priceList.id}`,
        label: `Precio ${priceList.name} (USD)`,
        type: 'number',
        required: true,
        min: 0.000001,
        step: '0.000001',
        pattern: '^\\d+(\\.\\d{1,6})?$',
        priceListId: priceList.id
      }))
    ];
  }

  private refreshAvailableFormFields(): void {
    const config = this.config();
    const fields = config?.fields ?? [];
    this.availableFormFields.set(
      config?.endpoint === 'products' ? this.buildProductFields(fields) : fields
    );
  }

  newRecord(): void {
    this.openForm(null);
  }

  editRecord(row: ModuleRow): void {
    this.openForm(row);
  }

  openForm(row: ModuleRow | null): void {
    this.selectedRow.set(row);
    const fields = row ? this.fieldsFor(row) : this.availableFormFields();
    this.activeFormFields.set(fields);
    const controls: Record<string, FormControl<string>> = {};
    for (const field of fields) {
      const validators = [];
      if (field.required) {
        validators.push(Validators.required);
      }
      if (field.maxLength) {
        validators.push(Validators.maxLength(field.maxLength));
      }
      if (field.type === 'email') {
        validators.push(Validators.email);
      }
      if (field.type === 'number' && field.min !== undefined) {
        validators.push(Validators.min(field.min));
      }
      if (field.pattern) {
        validators.push(Validators.pattern(field.pattern));
      }

      const value = row ? this.fieldValue(row, field.key) : '';
      controls[field.key] = new FormControl(
        {
          value,
          disabled: field.key === 'category_id' && this.categoryOptionsLoading()
        },
        {
        nonNullable: true,
        validators
        }
      );
    }

    this.formError.set('');
    this.form = new FormGroup(controls);
    this.formVisible.set(true);
  }

  saveRecord(): void {
    const config = this.config();
    const fields = this.formFields;
    if (!config || !fields.length || this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: Record<string, unknown> = {};
    const prices: Array<{ price_list_id: number; unit_id: null; amount: string }> = [];
    for (const field of fields) {
      const rawValue = this.form.controls[field.key].value.trim();
      if (field.priceListId !== undefined) {
        if (rawValue) {
          prices.push({
            price_list_id: field.priceListId,
            unit_id: null,
            amount: this.normalizeAmount(rawValue)
          });
        }
        continue;
      }
      if (field.key === 'category_id') {
        payload[field.key] = rawValue ? Number(rawValue) : null;
      } else if (field.type === 'number') {
        if (rawValue !== '') {
          payload[field.key] = Number(rawValue);
        }
      } else {
        payload[field.key] = rawValue || null;
      }
    }

    const row = this.selectedRow();
    if (!row && config.endpoint === 'products' && prices.length !== 2) {
      this.formError.set('Debes ingresar los precios USD de Detal y Mayorista.');
      return;
    }
    if (!row && config.endpoint === 'products') {
      payload['prices'] = prices;
    }
    const request = row
      ? this.#api.patch(`${config.endpoint}/${row['id']}`, payload)
      : this.#api.post(config.endpoint, payload);

    this.saving.set(true);
    this.formError.set('');
    request
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: () => {
          this.formVisible.set(false);
          this.successMessage.set(`Registro ${row ? 'actualizado' : 'creado'} correctamente.`);
          this.load(1);
        },
        error: (error: unknown) => this.formError.set(getApiErrorMessage(error))
      });
  }

  setActive(row: ModuleRow): void {
    const config = this.config();
    if (!config || typeof row['id'] !== 'number') {
      return;
    }

    const active = row['is_active'] === true;
    const action = active ? 'desactivar' : 'activar';
    const name = this.valueAt(row, config.columns[0]?.key ?? 'name');
    if (!window.confirm(`¿Deseas ${action} ${String(name || 'este registro')}?`)) {
      return;
    }

    const id = row['id'];
    this.actionId.set(id);
    this.successMessage.set('');
    const request = active
      ? this.#api.delete(`${config.endpoint}/${id}`)
      : this.#api.patch(`${config.endpoint}/${id}/activate`);
    request
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.actionId.set(null))
      )
      .subscribe({
        next: () => {
          this.successMessage.set(`Registro ${active ? 'desactivado' : 'activado'} correctamente.`);
          this.load(1);
        },
        error: (error: unknown) => this.errorMessage.set(getApiErrorMessage(error))
      });
  }

  toggleInactive(): void {
    this.showInactive.update((value) => !value);
    this.load(1);
  }

  fieldOptions(field: ErpField): ErpOption[] {
    return field.options ?? [];
  }

  isInvalid(field: ErpField): boolean {
    const control = this.form.controls[field.key];
    return Boolean(control?.touched && control.invalid);
  }

  load(page = this.currentPage()): void {
    const config = this.config();
    if (!config) {
      return;
    }

    let params = new HttpParams();
    if (config.paginated !== false) {
      params = params.set('per_page', '20').set('page', String(page));
    }
    if (config.supportsSearch && this.searchTerm().trim()) {
      params = params.set('search', this.searchTerm().trim());
    }
    if (this.manageable && this.showInactive()) {
      params = params.set('is_active', '0');
    }

    this.#request?.unsubscribe();
    this.loading.set(true);
    this.errorMessage.set('');
    this.#request = this.#api
      .get<PaginatedResponse<ModuleRow>>(config.endpoint, params)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          this.rows.set(response.data);
          this.currentPage.set(response.meta?.current_page ?? 1);
          this.lastPage.set(response.meta?.last_page ?? 1);
          this.total.set(response.meta?.total ?? response.data.length);
        },
        error: (error: unknown) => this.errorMessage.set(getApiErrorMessage(error))
      });
  }

  visibleRows(): ModuleRow[] {
    const config = this.config();
    const rows = this.rows();
    const term = this.searchTerm().trim().toLocaleLowerCase();

    if (!config || config.supportsSearch || !term) {
      return rows;
    }

    return rows.filter((row) =>
      config.columns.some((column) =>
        String(this.valueAt(row, column.key) ?? '').toLocaleLowerCase().includes(term)
      )
    );
  }

  cellValue(row: ModuleRow, column: ErpColumn): string {
    const value = this.valueAt(row, column.key);
    if (typeof value === 'boolean') {
      return value ? 'Activo' : 'Inactivo';
    }

    return value === undefined || value === null || value === '' ? '—' : String(value);
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.load(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.lastPage()) {
      this.load(this.currentPage() + 1);
    }
  }

  loadCategoryOptions(config: ErpModuleConfig): void {
    this.categoryOptionsLoading.set(true);
    this.form.controls['category_id']?.disable({ emitEvent: false });
    this.categoryOptionsError.set('');
    forkJoin([
      this.#api.get<{ data: Array<{ id: number; name: string }> }>('categories'),
      this.#api.get<{ data: Array<{ id: number; name: string }> }>(
        'categories',
        new HttpParams().set('is_active', '0')
      )
    ])
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.categoryOptionsLoading.set(false);
          this.form.controls['category_id']?.enable({ emitEvent: false });
        })
      )
      .subscribe({
        next: ([active, inactive]) => {
          if (this.config()?.endpoint !== config.endpoint) {
            return;
          }

          const categories = [...active.data, ...inactive.data];
          const fields = config.fields?.map((field) => field.key === 'category_id'
            ? {
                ...field,
                options: [
                  { value: '', label: 'Sin categoría' },
                  ...categories.map((category) => ({
                    value: String(category.id),
                    label: category.name
                  }))
                ]
              }
            : field);
          this.config.set({ ...config, fields });
          this.refreshAvailableFormFields();
          this.categoryOptionsLoaded.set(true);
        },
        error: (error: unknown) => this.categoryOptionsError.set(getApiErrorMessage(error))
      });
  }

  loadProductPriceLists(): void {
    this.productPriceListsLoading.set(true);
    this.productPriceListsError.set('');
    this.#priceListsApi.list(true)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.productPriceListsLoading.set(false))
      )
      .subscribe({
        next: (response) => {
          const lists = response.data.filter((list) =>
            (list.code === 'retail' || list.code === 'wholesale') && list.currency === 'USD'
          );
          if (lists.length !== 2) {
            this.productPriceLists.set([]);
            this.productPriceListsError.set('Deben estar activas las listas Detal y Mayorista en USD.');
            return;
          }
          this.productPriceLists.set(lists.sort((a, b) => a.code.localeCompare(b.code)));
          this.refreshAvailableFormFields();
        },
        error: (error: unknown) => this.productPriceListsError.set(getApiErrorMessage(error))
      });
  }

  private fieldValue(row: ModuleRow, key: string): string {
    if (key === 'category_id') {
      const categoryId = this.valueAt(row, 'category.id');
      return categoryId === undefined || categoryId === null ? '' : String(categoryId);
    }

    const value = this.valueAt(row, key);
    return value === undefined || value === null ? '' : String(value);
  }

  private normalizeAmount(value: string): string {
    const [whole, fraction = ''] = value.split('.');
    return `${whole}.${fraction.padEnd(6, '0')}`;
  }

  private valueAt(row: ModuleRow, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (typeof current !== 'object' || current === null) {
        return undefined;
      }

      return (current as Record<string, unknown>)[key];
    }, row);
  }
}
