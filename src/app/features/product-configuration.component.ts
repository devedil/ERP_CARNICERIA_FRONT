import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
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
import { finalize, forkJoin, Observable } from 'rxjs';

import { getApiErrorMessage } from '../core/api-error';
import {
  PriceList,
  Product,
  ProductPrice,
  ProductUnitConversion,
  Unit
} from '../core/models/catalog.models';
import { PriceListService } from '../core/services/price-list.service';
import { ProductService } from '../core/services/product.service';
import { UnitService } from '../core/services/unit.service';

@Component({
  selector: 'app-product-configuration',
  templateUrl: './product-configuration.component.html',
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
    RouterLink,
    RowComponent,
    TableDirective
  ]
})
export class ProductConfigurationComponent implements OnInit {
  readonly #route = inject(ActivatedRoute);
  readonly #destroyRef = inject(DestroyRef);
  readonly #changeDetector = inject(ChangeDetectorRef);
  readonly #products = inject(ProductService);
  readonly #units = inject(UnitService);
  readonly #priceLists = inject(PriceListService);

  product: Product | null = null;
  conversions: ProductUnitConversion[] = [];
  prices: ProductPrice[] = [];
  units: Unit[] = [];
  priceLists: PriceList[] = [];
  loading = false;
  readonly pricesLoading = signal(false);
  saving = false;
  actionId: number | null = null;
  pageError = '';
  priceError = '';
  formError = '';
  successMessage = '';
  conversionModalVisible = false;
  priceModalVisible = false;
  selectedConversion: ProductUnitConversion | null = null;
  conversionForm = new FormGroup({
    unit_id: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    factor_to_base: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^\d+(\.\d{1,6})?$/),
        Validators.min(0.000001)
      ]
    })
  });
  priceForm = new FormGroup({
    price_list_id: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    unit_id: new FormControl('', { nonNullable: true }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^\d+(\.\d{1,6})?$/),
        Validators.min(0.000001)
      ]
    })
  });

  ngOnInit(): void {
    this.#route.paramMap.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((params) => {
      const productId = Number(params.get('productId'));
      if (!Number.isInteger(productId) || productId <= 0) {
        this.pageError = 'El identificador del producto no es válido.';
        return;
      }
      this.load(productId);
    });
  }

  get availableUnits(): Unit[] {
    return this.units.filter((unit) => unit.code !== this.product?.base_unit);
  }

  load(productId = this.product?.id): void {
    if (!productId) {
      return;
    }

    this.loading = true;
    this.pageError = '';
    this.priceError = '';
    this.prices = [];
    this.pricesLoading.set(true);
    forkJoin({
      product: this.#products.get(productId),
      conversions: this.#products.conversions(productId),
      units: this.#units.list(true),
      priceLists: this.#priceLists.list(true)
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (result) => {
          this.product = result.product.data;
          this.conversions = result.conversions.data;
          this.units = result.units.data.filter((unit) => unit.is_active);
          this.priceLists = result.priceLists.data.filter((priceList) =>
            priceList.is_active &&
            priceList.currency === 'USD' &&
            (priceList.code === 'retail' || priceList.code === 'wholesale')
          );
        },
        error: (error: unknown) => this.pageError = this.apiErrorMessage(error)
      });

    this.#products.prices(productId)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.pricesLoading.set(false);
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.prices = result.data;
          this.pricesLoading.set(false);
          this.#changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.priceError = this.apiErrorMessage(error);
          this.pricesLoading.set(false);
          this.#changeDetector.markForCheck();
        }
      });
  }

  openConversion(conversion: ProductUnitConversion | null = null): void {
    this.selectedConversion = conversion;
    this.formError = '';
    this.conversionForm.reset({
      unit_id: conversion ? String(conversion.unit.id) : '',
      factor_to_base: conversion?.factor_to_base ?? ''
    });
    this.conversionModalVisible = true;
  }

  saveConversion(): void {
    const productId = this.product?.id;
    if (!productId || this.conversionForm.invalid || this.saving) {
      this.conversionForm.markAllAsTouched();
      return;
    }

    const selected = this.selectedConversion;
    const body = {
      unit_id: Number(this.conversionForm.controls.unit_id.value),
      factor_to_base: this.conversionForm.controls.factor_to_base.value
    };
    const request = selected
      ? this.#products.updateConversion(selected.id, body)
      : this.#products.addConversion(productId, body);
    this.submit(request, () => {
      this.conversionModalVisible = false;
      this.successMessage = `Conversión ${selected ? 'actualizada' : 'creada'} correctamente.`;
      this.load(productId);
    });
  }

  deactivateConversion(conversion: ProductUnitConversion): void {
    if (!window.confirm(`¿Deseas desactivar la conversión a ${conversion.unit.name}?`)) {
      return;
    }

    this.actionId = conversion.id;
    this.formError = '';
    this.#products.deactivateConversion(conversion.id)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.actionId = null)
      )
      .subscribe({
        next: () => {
          this.successMessage = 'Conversión desactivada correctamente.';
          this.load();
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  openPrice(): void {
    this.formError = '';
    this.priceForm.reset({ price_list_id: '', unit_id: '', amount: '' });
    this.priceModalVisible = true;
  }

  savePrice(): void {
    const productId = this.product?.id;
    if (!productId || this.priceForm.invalid || this.saving) {
      this.priceForm.markAllAsTouched();
      return;
    }

    const { price_list_id, unit_id, amount } = this.priceForm.getRawValue();
    const [whole, fraction = ''] = amount.split('.');
    this.submit(this.#products.addPrice(productId, {
      price_list_id: Number(price_list_id),
      unit_id: unit_id ? Number(unit_id) : null,
      amount: `${whole}.${fraction.padEnd(6, '0')}`
    }), () => {
      this.priceModalVisible = false;
      this.successMessage = 'Precio agregado correctamente.';
      this.load(productId);
    });
  }

  private submit<T>(request: Observable<T>, onSuccess: () => void): void {
    this.saving = true;
    this.formError = '';
    request
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: onSuccess,
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  private apiErrorMessage(error: unknown): string {
    const message = getApiErrorMessage(error);
    return error instanceof HttpErrorResponse && error.status
      ? `HTTP ${error.status}: ${message}`
      : message;
  }
}
