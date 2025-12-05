import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class Profile implements OnInit {
  profileData = {
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    county: '',
    postalCode: '',
    userType: 'contractor',
    kbrcCertified: false,
    certificationNumber: ''
  };

  isEditing = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    // Load from localStorage or API
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      const user = JSON.parse(userData);
      this.profileData.companyName = user.companyName || '';
      this.profileData.contactPerson = user.contactPerson || '';
      this.profileData.email = user.email || '';
      this.profileData.userType = user.role?.toLowerCase() || 'contractor';
    }
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    this.successMessage = '';
    this.errorMessage = '';
  }

  saveProfile(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Simulate API call
    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Profile updated successfully!';
      this.isEditing = false;

      // Update localStorage
      const userData = {
        ...JSON.parse(localStorage.getItem('currentUser') || '{}'),
        companyName: this.profileData.companyName,
        contactPerson: this.profileData.contactPerson,
        email: this.profileData.email
      };
      localStorage.setItem('currentUser', JSON.stringify(userData));
    }, 1500);
  }

  cancel(): void {
    this.loadProfile();
    this.isEditing = false;
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
