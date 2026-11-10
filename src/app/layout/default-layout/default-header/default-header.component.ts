import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import {
  BreadcrumbRouterComponent,
  ColorModeService,
  ContainerComponent,
  DropdownComponent,
  DropdownHeaderDirective,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  HeaderComponent,
  HeaderNavComponent,
  HeaderTogglerDirective,
  SidebarToggleDirective
} from '@coreui/angular';

import { IconDirective } from '@coreui/icons-angular';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  imports: [
    BreadcrumbRouterComponent,
    ContainerComponent,
    DropdownComponent,
    DropdownHeaderDirective,
    DropdownItemDirective,
    DropdownMenuDirective,
    DropdownToggleDirective,
    HeaderNavComponent,
    HeaderTogglerDirective,
    IconDirective,
    NgTemplateOutlet,
    SidebarToggleDirective
  ]
})
export class DefaultHeaderComponent extends HeaderComponent {

  readonly #colorModeService = inject(ColorModeService);
  readonly #authService = inject(AuthService);
  readonly #router = inject(Router);
  readonly colorMode = this.#colorModeService.colorMode;
  readonly logoutError = signal('');

  readonly colorModes = [
    { name: 'light', text: 'Claro', icon: 'cilSun' },
    { name: 'dark', text: 'Oscuro', icon: 'cilMoon' },
    { name: 'auto', text: 'Sistema', icon: 'cilContrast' }
  ];

  readonly icons = computed(() => {
    const currentMode = this.colorMode();
    return this.colorModes.find(mode => mode.name === currentMode)?.icon ?? 'cilSun';
  });

  constructor() {
    super();
  }

  readonly sidebarId = input('sidebar1');

  userName(): string {
    return this.#authService.user()?.name ?? 'Usuario';
  }

  logout(): void {
    this.logoutError.set('');
    this.#authService.logout().subscribe({
      next: () => void this.#router.navigate(['/authentication/login']),
      error: () => this.logoutError.set('No se pudo cerrar la sesión. Inténtalo nuevamente.')
    });
  }
}
