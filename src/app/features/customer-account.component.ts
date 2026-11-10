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
  CustomerCreditAccount,
  ExchangeRate
} from '../core/models/catalog.models';
import { CashService } from '../core/services/cash.service';
import { CustomerService } from '../core/services/customer.service';
import { ExchangeRateService } from '../core/services/exchange-rate.service';
import { SalePaymentInput, SaleService } from '../core/services/sale.service';
import {
  decimalToScaled,
  divideDecimalsToSix,
  multiplyDecimalValuesToSix,
  scaledToDecimal
} from '../core/utils/decimal';

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
  readonly #exchangeRatesApi = inject(ExchangeRateService);
  readonly #salesApi = inject(SaleService);
  readonly #changeDetector = inject(ChangeDetectorRef);

  creditAccounts: CustomerCreditAccount[] = [];
  openSessions: CashSession[] = [];
  exchangeRate: ExchangeRate | null = null;
  statement: CustomerAccountStatement | null = null;
  selectedCreditAccount: CustomerCreditAccount | null = null;
  loadingAccounts = false;
  loadingExchangeRate = false;
  loadingStatement = false;
  savingPayment = false;
  accountModalVisible = false;
  paymentModalVisible = false;
  selectedEntry: CustomerAccountEntry | null = null;
  pageError = '';
  exchangeRateError = '';
  statementError = '';
  paymentError = '';
  successMessage = '';
  readonly paymentForm = new FormGroup({
    cash_session_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    payment_method: new FormControl('cash', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<string | number>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,6})?$/)]
    })
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loadingAccounts = true;
    this.pageError = '';
    this.loadExchangeRate();
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
    this.loadExchangeRate();
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
    this.#customersApi.accountStatement(customerId)
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

  openPayment(entry: CustomerAccountEntry): void {
    this.selectedEntry = entry;
    this.paymentError = '';
    this.paymentForm.reset({
      cash_session_id: '',
      payment_method: 'cash',
      amount: ''
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

  onPaymentSessionChanged(): void {
    this.paymentError = '';
    const session = this.selectedPaymentSession();
    const entry = this.selectedEntry;
    if (!session || !entry) {
      return;
    }

    if (session.currency === 'USD') {
      this.paymentForm.controls.amount.setValue(entry.usd_balance);
    } else if (session.currency === 'VES' && this.exchangeRate) {
      this.paymentForm.controls.amount.setValue(multiplyDecimalValuesToSix(entry.usd_balance, this.exchangeRate.rate));
    } else {
      this.paymentError = this.exchangeRate
        ? 'La moneda de la caja no es compatible con los créditos (USD/VES).'
        : 'No se pudo cargar la tasa oficial USD/VES.';
    }
  }

  paymentAppliedUsd(): string {
    const amount = this.paymentForm.controls.amount.value;
    const session = this.selectedPaymentSession();
    if (amount === '' || !session) {
      return '0.000000';
    }

    if (session.currency === 'USD') {
      return scaledToDecimal(decimalToScaled(String(amount), 6), 6);
    }
    return this.exchangeRate
      ? divideDecimalsToSix(String(amount), this.exchangeRate.rate)
      : '0.000000';
  }

  paymentVesEquivalent(amountUsd: string): string | null {
    return this.exchangeRate ? multiplyDecimalValuesToSix(amountUsd, this.exchangeRate.rate) : null;
  }

  refreshExchangeRate(): void {
    this.loadExchangeRate();
  }

  private loadExchangeRate(): void {
    this.loadingExchangeRate = true;
    this.exchangeRateError = '';
    this.#exchangeRatesApi.current()
      .pipe(
        takeUntilDestroyed(this.#destroyRef),
        finalize(() => {
          this.loadingExchangeRate = false;
          this.#changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: ({ data }) => {
          this.exchangeRate = data;
          this.#changeDetector.markForCheck();
        },
        error: (error: unknown) => {
          this.exchangeRate = null;
          this.exchangeRateError = getApiErrorMessage(error);
          this.#changeDetector.markForCheck();
        }
      });
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
    if (!this.exchangeRate) {
      this.paymentError = 'No se pudo cargar la tasa oficial USD/VES. Actualiza la tasa antes de registrar el abono.';
      return;
    }
    if (!['USD', 'VES'].includes(session.currency)) {
      this.paymentError = 'Los abonos de crédito solo pueden registrarse en VES o USD.';
      return;
    }
    if (decimalToScaled(this.paymentAppliedUsd(), 6) > decimalToScaled(entry.usd_balance, 6)) {
      this.paymentError = 'El abono aplicado supera el saldo pendiente en USD.';
      return;
    }
    const appliedUsd = this.paymentAppliedUsd();
    if (!window.confirm(`¿Confirmas recibir ${values.amount} ${session.currency} (${appliedUsd} USD)?`)) {
      return;
    }

    const body: SalePaymentInput = {
      cash_session_id: session.id,
      payment_method: values.payment_method,
      amount: this.normalizeDecimal(values.amount),
      exchange_rate: this.exchangeRate.rate
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
