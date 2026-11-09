import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
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
  CashSession,
  CustomerAccountEntry,
  CustomerAccountStatement,
  CustomerCreditAccount
} from '../core/models/catalog.models';
import { CashService } from '../core/services/cash.service';
import { CustomerService } from '../core/services/customer.service';
import { SalePaymentInput, SaleService } from '../core/services/sale.service';
import { decimalToScaled, multiplyDecimalsToSix, scaledToDecimal } from '../core/utils/decimal';

@Component({
  selector: 'app-customer-account',
  templateUrl: './customer-account.component.html',
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
export class CustomerAccountComponent implements OnInit {
  readonly #destroyRef = inject(DestroyRef);
  readonly #customersApi = inject(CustomerService);
  readonly #cashApi = inject(CashService);
  readonly #salesApi = inject(SaleService);
  readonly #changeDetector = inject(ChangeDetectorRef);

  readonly currencyControl = new FormControl('', { nonNullable: true });
  creditAccounts: CustomerCreditAccount[] = [];
  openSessions: CashSession[] = [];
  statement: CustomerAccountStatement | null = null;
  selectedCreditAccount: CustomerCreditAccount | null = null;
  availableCurrencies: string[] = [];
  loadingAccounts = false;
  loadingStatement = false;
  savingPayment = false;
  accountModalVisible = false;
  paymentModalVisible = false;
  selectedEntry: CustomerAccountEntry | null = null;
  pageError = '';
  statementError = '';
  paymentError = '';
  successMessage = '';
  readonly paymentForm = new FormGroup({
    cash_session_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    payment_method: new FormControl('cash', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<string | number>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,6})?$/)]
    }),
    exchange_rate: new FormControl<string | number>('', {
      nonNullable: true,
      validators: [Validators.pattern(/^\d+(\.\d{1,6})?$/)]
    })
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loadingAccounts = true;
    this.pageError = '';
    forkJoin({
      accounts: this.#customersApi.creditAccounts(),
      sessions: this.#cashApi.openSessions()
    })
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.loadingAccounts = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: (result) => {
          this.creditAccounts = result.accounts.data;
          this.openSessions = result.sessions.data.filter((session) => session.status === 'open');
          this.#changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.pageError = getApiErrorMessage(error);
          this.#changeDetector.markForCheck();
        }
      });
  }

  refresh(): void {
    this.loadingAccounts = true;
    this.pageError = '';
    this.#customersApi.creditAccounts()
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.loadingAccounts = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: ({ data }) => {
          this.creditAccounts = data;
          if (this.selectedCreditAccount) {
            this.selectedCreditAccount = data.find(
              (account) => account.customer.id === this.selectedCreditAccount?.customer.id
            ) ?? this.selectedCreditAccount;
          }
          this.#changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.pageError = getApiErrorMessage(error);
          this.#changeDetector.markForCheck();
        }
      });
    if (this.selectedCreditAccount) {
      this.loadStatement();
    }
  }

  openCustomerAccount(account: CustomerCreditAccount): void {
    this.selectedCreditAccount = account;
    this.currencyControl.setValue('');
    this.availableCurrencies = account.balances.map((balance) => balance.currency);
    this.statement = null;
    this.statementError = '';
    this.accountModalVisible = true;
    this.loadStatement();
  }

  loadStatement(): void {
    const customerId = this.selectedCreditAccount?.customer.id;
    if (!customerId) {
      this.statement = null;
      this.statementError = '';
      return;
    }

    this.loadingStatement = true;
    this.statementError = '';
    this.#customersApi.accountStatement(customerId, this.currencyControl.value || undefined)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.loadingStatement = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: ({ data }) => {
          this.statement = data;
          this.#changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.statement = null;
          this.statementError = getApiErrorMessage(error);
          this.#changeDetector.markForCheck();
        }
      });
  }

  onCurrencyChanged(): void {
    this.loadStatement();
  }

  openPayment(entry: CustomerAccountEntry): void {
    this.selectedEntry = entry;
    this.paymentError = '';
    this.paymentForm.reset({
      cash_session_id: '',
      payment_method: 'cash',
      amount: '',
      exchange_rate: ''
    });
    this.accountModalVisible = false;
    this.paymentModalVisible = true;
  }

  closePayment(): void {
    this.paymentModalVisible = false;
    this.accountModalVisible = Boolean(this.selectedCreditAccount);
  }

  selectedPaymentSession(): CashSession | undefined {
    return this.openSessions.find((session) => String(session.id) === this.paymentForm.controls.cash_session_id.value);
  }

  paymentRequiresExchangeRate(): boolean {
    const session = this.selectedPaymentSession();
    return Boolean(session && this.selectedEntry && session.currency !== this.selectedEntry.currency);
  }

  paymentAppliedAmount(): string {
    const amount = this.paymentForm.controls.amount.value;
    const rate = this.paymentForm.controls.exchange_rate.value;
    if (amount === '') {
      return '0.000000';
    }

    return this.paymentRequiresExchangeRate() && rate
      ? multiplyDecimalsToSix(String(amount), String(rate))
      : scaledToDecimal(decimalToScaled(String(amount), 6), 6);
  }

  savePayment(): void {
    const entry = this.selectedEntry;
    if (!entry || this.paymentForm.invalid || this.savingPayment) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const values = this.paymentForm.getRawValue();
    const session = this.openSessions.find((item) => String(item.id) === values.cash_session_id);
    if (!session) {
      this.paymentError = 'Selecciona una sesión de caja abierta.';
      return;
    }
    if (session.currency !== entry.currency && !values.exchange_rate) {
      this.paymentError = `Indica cuántas unidades de ${entry.currency} corresponden a una unidad de ${session.currency}.`;
      return;
    }
    if (decimalToScaled(this.paymentAppliedAmount(), 6) > decimalToScaled(entry.balance, 6)) {
      this.paymentError = 'El abono aplicado supera el saldo pendiente de esta venta.';
      return;
    }
    if (!window.confirm(`¿Confirmas registrar el abono de ${values.amount} ${session.currency}?`)) {
      return;
    }

    const body: SalePaymentInput = {
      cash_session_id: session.id,
      payment_method: values.payment_method,
      amount: this.normalizeDecimal(values.amount),
      ...(session.currency !== entry.currency
        ? { exchange_rate: this.normalizeDecimal(values.exchange_rate) }
        : {})
    };

    this.savingPayment = true;
    this.paymentError = '';
    this.#salesApi.pay(entry.sale_id, body)
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.savingPayment = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.paymentModalVisible = false;
          this.accountModalVisible = true;
          this.successMessage = `Abono registrado para ${this.documentLabel(entry)}.`;
          this.refresh();
          this.#changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.paymentError = getApiErrorMessage(error);
          this.#changeDetector.markForCheck();
        }
      });
  }

  private normalizeDecimal(value: string | number): string {
    return scaledToDecimal(decimalToScaled(String(value).trim().replace(',', '.'), 6), 6);
  }

  documentLabel(entry: CustomerAccountEntry): string {
    return entry.document_number || `Venta #${entry.sale_id}`;
  }
}
