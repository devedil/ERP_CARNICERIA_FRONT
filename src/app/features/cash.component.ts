import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { finalize, forkJoin } from 'rxjs';

import { getApiErrorMessage } from '../core/api-error';
import {
  CashExpenseCategory,
  CashMovement,
  CashSession,
  CashSessionSummary
} from '../core/models/catalog.models';
import { CashService } from '../core/services/cash.service';

@Component({
  selector: 'app-cash',
  templateUrl: './cash.component.html',
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
export class CashComponent implements OnInit {
  readonly #destroyRef = inject(DestroyRef);
  readonly #cash = inject(CashService);

  sessions: CashSession[] = [];
  movements: CashMovement[] = [];
  expenseCategories: CashExpenseCategory[] = [];
  summary: CashSessionSummary | null = null;
  selectedSessionId = '';
  loading = false;
  saving = false;
  pageError = '';
  formError = '';
  successMessage = '';
  openModalVisible = false;
  movementModalVisible = false;
  closeModalVisible = false;
  readonly openForm = new FormGroup({
    cash_register_id: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[1-9]\d*$/)]
    }),
    currency: new FormControl('VES', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]
    }),
    opening_amount: new FormControl('0', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,6})?$/)]
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] })
  });
  readonly movementForm = new FormGroup({
    movement_type: new FormControl<'income' | 'expense'>('income', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^(?=.*[1-9])\d+(\.\d{1,6})?$/)]
    }),
    expense_category_id: new FormControl('', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255)] })
  });
  readonly closeForm = new FormGroup({
    closing_amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,6})?$/)]
    }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] })
  });

  ngOnInit(): void {
    this.load();
  }

  get selectedSession(): CashSession | undefined {
    return this.sessions.find((session) => String(session.id) === this.selectedSessionId);
  }

  load(): void {
    this.loading = true;
    this.pageError = '';
    forkJoin({
      sessions: this.#cash.sessions(),
      expenseCategories: this.#cash.expenseCategories()
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (result) => {
          this.sessions = result.sessions.data;
          this.expenseCategories = result.expenseCategories.data;
          if (!this.selectedSessionId || !this.sessions.some((session) => String(session.id) === this.selectedSessionId)) {
            this.selectedSessionId = String(this.sessions.find((session) => session.status === 'open')?.id ?? this.sessions[0]?.id ?? '');
          }
          if (this.selectedSessionId) {
            this.loadDetails(Number(this.selectedSessionId));
          } else {
            this.summary = null;
            this.movements = [];
          }
        },
        error: (error: unknown) => this.pageError = getApiErrorMessage(error)
      });
  }

  selectSession(event: Event): void {
    this.selectSessionId(Number((event.target as HTMLSelectElement).value));
  }

  selectSessionId(id: number): void {
    this.selectedSessionId = String(id);
    if (this.selectedSessionId) {
      this.loadDetails(Number(this.selectedSessionId));
    }
  }

  isSelectedSession(id: number): boolean {
    return this.selectedSessionId === String(id);
  }

  loadDetails(sessionId: number): void {
    this.pageError = '';
    forkJoin({
      summary: this.#cash.summary(sessionId),
      movements: this.#cash.movements(sessionId)
    })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (result) => {
          this.summary = result.summary.data;
          this.movements = result.movements.data;
        },
        error: (error: unknown) => this.pageError = getApiErrorMessage(error)
      });
  }

  openSession(): void {
    this.formError = '';
    this.openForm.reset({
      cash_register_id: '',
      currency: 'VES',
      opening_amount: '0',
      notes: ''
    });
    this.openModalVisible = true;
  }

  saveOpenSession(): void {
    if (this.openForm.invalid || this.saving) {
      this.openForm.markAllAsTouched();
      return;
    }
    const values = this.openForm.getRawValue();
    this.saving = true;
    this.formError = '';
    this.#cash.open({
      cash_register_id: Number(values.cash_register_id),
      currency: values.currency,
      opening_amount: values.opening_amount,
      notes: values.notes.trim() || null
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: ({ data }) => {
          this.openModalVisible = false;
          this.selectedSessionId = String(data.id);
          this.successMessage = `Sesión de caja #${data.id} abierta.`;
          this.load();
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  openMovement(): void {
    this.formError = '';
    this.movementForm.reset({
      movement_type: 'income',
      amount: '',
      expense_category_id: '',
      reason: ''
    });
    this.movementModalVisible = true;
  }

  saveMovement(): void {
    const sessionId = Number(this.selectedSessionId);
    if (!sessionId || !this.movementForm.valid || this.saving) {
      this.movementForm.markAllAsTouched();
      return;
    }
    const values = this.movementForm.getRawValue();
    if (values.movement_type === 'expense' && !values.expense_category_id) {
      this.formError = 'Selecciona la categoría del egreso.';
      return;
    }
    this.saving = true;
    this.formError = '';
    this.#cash.recordMovement(sessionId, {
      movement_type: values.movement_type,
      amount: values.amount,
      reason: values.reason.trim(),
      ...(values.movement_type === 'expense' ? { expense_category_id: Number(values.expense_category_id) } : {})
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.movementModalVisible = false;
          this.successMessage = `${values.movement_type === 'income' ? 'Ingreso' : 'Egreso'} registrado correctamente.`;
          this.loadDetails(sessionId);
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }

  openCloseSession(): void {
    this.formError = '';
    this.closeForm.reset({ closing_amount: this.summary?.expected_amount ?? '', notes: '' });
    this.closeModalVisible = true;
  }

  saveCloseSession(): void {
    const sessionId = Number(this.selectedSessionId);
    if (!sessionId || this.closeForm.invalid || this.saving) {
      this.closeForm.markAllAsTouched();
      return;
    }
    if (!window.confirm('¿Confirmas cerrar esta sesión de caja?')) {
      return;
    }
    const values = this.closeForm.getRawValue();
    this.saving = true;
    this.formError = '';
    this.#cash.close(sessionId, {
      closing_amount: values.closing_amount,
      notes: values.notes.trim() || null
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.closeModalVisible = false;
          this.successMessage = 'Sesión de caja cerrada correctamente.';
          this.load();
        },
        error: (error: unknown) => this.formError = getApiErrorMessage(error)
      });
  }
}
