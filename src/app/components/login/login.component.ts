import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class Login {
  credentials = {
    email: '',
    password: ''
  };
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  rememberMe = false;
  emailInvalid = false;
  passwordInvalid = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  validateEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailInvalid = !emailRegex.test(this.credentials.email);
  }

  validatePassword() {
    this.passwordInvalid = this.credentials.password.length < 6;
  }

  onSubmit() {
    this.clearMessages();
    this.validateEmail();
    this.validatePassword();

    if (!this.credentials.email || !this.credentials.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    if (this.emailInvalid) {
      this.errorMessage = 'Please enter a valid email address.';
      return;
    }

    if (this.passwordInvalid) {
      this.errorMessage = 'Password must be at least 6 characters long.';
      return;
    }

    this.isLoading = true; // FIXED: Uncommented this line
    console.log('Attempting login with', this.credentials);
    this.authService.login(this.credentials.email, this.credentials.password)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          console.log('Login response:', response);
          if (response.success) {
            this.successMessage = 'Login successful! Redirecting to dashboard...';
            
            // Use the correct dashboard path based on your routes
            setTimeout(() => {
              if (response.role === 'SUPPLIER') {
                this.router.navigate(['/supplier-dashboard']);
              } else if (response.role === 'CONTRACTOR') {
                this.router.navigate(['/contractor-dashboard']);
              } else if (response.role === 'SUPER_ADMIN') {
                this.router.navigate(['/admin-dashboard']);
              } else {
                // Fallback to home or appropriate route
                this.router.navigate(['/']);
              }
            }, 1500);
          } else {
            this.errorMessage = response.message || 'Login failed. Please try again.';
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Login error:', error);
          
          // Better error handling
          if (error.status === 401) {
            this.errorMessage = 'Invalid email or password.';
          } else if (error.status === 403) {
            this.errorMessage = 'Account not verified or access denied.';
          } else if (error.status === 0) {
            this.errorMessage = 'Network error. Please check your connection.';
          } else {
            this.errorMessage = error.error?.message || 'Login failed. Please try again.';
          }
          
          this.credentials.password = '';
        }
      });
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  // Optional: Add demo account auto-fill for testing
  useDemoAccount(role: 'supplier' | 'contractor') {
    if (role === 'supplier') {
      this.credentials.email = 'mosesgjuma@gmail.com';
      this.credentials.password = 'demo123';
    } else if (role === 'contractor') {
      this.credentials.email = 'contractor@demo.com';
      this.credentials.password = 'demo123';
    }
    this.clearMessages();
  }
}