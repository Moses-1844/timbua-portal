import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from './supplier.service';
import { Supplier, SupplierDocument, MaterialSite, ApiResponse } from './supplier.types';
import * as jspdf from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-admin-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-suppliers.component.html',
  styleUrls: ['./admin-suppliers.component.scss']
})
export class AdminSuppliersComponent implements OnInit {
  suppliers: Supplier[] = [];
  materialSites: MaterialSite[] = [];
  selectedSupplier: Supplier | null = null;
  supplierDocuments: SupplierDocument[] = [];
  
  // Modal states
  showSupplierModal = false;
  showMaterialSiteModal = false;
  showDocumentsModal = false;
  showBulkUploadModal = false;
  showEditMaterialSiteModal = false;
  
  // Form models
  newSupplier: Partial<Supplier> = {};
  newMaterialSite: Partial<MaterialSite> = {};
  editingMaterialSite: MaterialSite | null = null;
  bulkMaterialSites: Partial<MaterialSite>[] = [{ ...this.getEmptyMaterialSite() }];
  editMode = false;
  selectedFile: File | null = null;
  
  // Filter
  searchTerm = '';
  supplierStatusFilter = 'ALL';
  materialFilter = '';
  countyFilter = '';
  
  // Pagination
  currentSupplierPage = 1;
  currentMaterialPage = 1;
  itemsPerPage = 10;
  
  // Tab management
  activeTab: 'suppliers' | 'materialSites' | 'reports' = 'suppliers';

  // Statistics
  verifiedSuppliersCount = 0;
  pendingSuppliersCount = 0;
  uniqueMaterialsCount = 0;
  uniqueCountiesCount = 0;

  constructor(private supplierService: SupplierService) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadMaterialSites();
  }

  loadSuppliers(): void {
    this.supplierService.getAllSuppliers().subscribe({
      next: (response: ApiResponse<Supplier[]>) => {
        this.suppliers = response.data || [];
        this.updateSupplierStats();
      },
      error: (error: any) => {
        console.error('Error loading suppliers:', error);
      }
    });
  }

  loadMaterialSites(): void {
    this.supplierService.getAllMaterialSites().subscribe({
      next: (data: MaterialSite[]) => {
        this.materialSites = data;
        this.updateMaterialStats();
      },
      error: (error: any) => {
        console.error('Error loading material sites:', error);
      }
    });
  }

  updateSupplierStats(): void {
    this.verifiedSuppliersCount = this.suppliers.filter(s => s.verified).length;
    this.pendingSuppliersCount = this.suppliers.filter(s => s.status === 'PENDING').length;
  }

  updateMaterialStats(): void {
    const materials = this.materialSites.map(m => m.material).filter(Boolean);
    const counties = this.materialSites.map(m => m.county).filter(Boolean);
    this.uniqueMaterialsCount = new Set(materials).size;
    this.uniqueCountiesCount = new Set(counties).size;
  }

  // Supplier Management
  openSupplierModal(supplier?: Supplier): void {
    if (supplier) {
      this.selectedSupplier = { ...supplier };
      this.editMode = true;
    } else {
      this.selectedSupplier = null;
      this.editMode = false;
      this.newSupplier = {
        status: 'PENDING',
        role: 'SUPPLIER',
        verified: false
      };
    }
    this.showSupplierModal = true;
  }

  closeSupplierModal(): void {
    this.showSupplierModal = false;
    this.selectedSupplier = null;
    this.newSupplier = {};
  }

  saveSupplier(): void {
    if (this.editMode && this.selectedSupplier) {
      this.supplierService.updateSupplier(this.selectedSupplier.id, this.selectedSupplier).subscribe({
        next: () => {
          this.loadSuppliers();
          this.closeSupplierModal();
        }
      });
    } else {
      const supplierToRegister = {
        companyName: this.newSupplier.companyName || '',
        businessRegistrationNumber: this.newSupplier.businessRegistrationNumber || '',
        contactPerson: this.newSupplier.contactPerson || '',
        email: this.newSupplier.email || '',
        password: this.newSupplier.password || 'DefaultPassword123!',
        phone: this.newSupplier.phone || '',
        website: this.newSupplier.website || '',
        description: this.newSupplier.description || '',
        yearsInBusiness: this.newSupplier.yearsInBusiness || 0,
        status: 'PENDING' as const,
        role: 'SUPPLIER' as const,
        verified: false
      };
      
      this.supplierService.registerSupplier(supplierToRegister).subscribe({
        next: () => {
          this.loadSuppliers();
          this.closeSupplierModal();
        },
        error: (error: any) => {
          console.error('Error registering supplier:', error);
        }
      });
    }
  }

  verifySupplier(supplierId: number, approve: boolean = true): void {
    this.supplierService.verifySupplier(supplierId, approve).subscribe({
      next: () => {
        this.loadSuppliers();
      }
    });
  }

  deleteSupplier(supplierId: number): void {
    if (confirm('Are you sure you want to delete this supplier?')) {
      this.supplierService.deleteSupplier(supplierId).subscribe({
        next: () => {
          this.loadSuppliers();
        }
      });
    }
  }

  viewDocuments(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.supplierService.getSupplierDocuments(supplier.id).subscribe({
      next: (response: ApiResponse<SupplierDocument[]>) => {
        this.supplierDocuments = response.data || [];
        this.showDocumentsModal = true;
      }
    });
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  uploadDocument(): void {
    if (this.selectedSupplier && this.selectedFile) {
      this.supplierService.uploadSupplierDocument(this.selectedSupplier.id, this.selectedFile).subscribe({
        next: () => {
          if (this.selectedSupplier) {
            this.viewDocuments(this.selectedSupplier);
          }
          this.selectedFile = null;
        }
      });
    }
  }

  // Material Sites Management
  getEmptyMaterialSite(): Partial<MaterialSite> {
    return {
      questionnaireNo: 0,
      researchAssistantNo: '',
      material: '',
      materialLocation: '',
      latitude: 0,
      longitude: 0,
      materialUsedIn: '',
      sizeOfManufacturingIndustry: '',
      periodOfManufacture: '',
      ownerOfMaterial: '',
      materialUsage: '',
      numberOfPeopleEmployed: '',
      similarLocations: '',
      volumeProducedPerDay: '',
      comments: '',
      county: '',
      subCounty: ''
    };
  }

  openMaterialSiteModal(): void {
    this.newMaterialSite = this.getEmptyMaterialSite();
    this.showMaterialSiteModal = true;
  }

  closeMaterialSiteModal(): void {
    this.showMaterialSiteModal = false;
    this.newMaterialSite = {};
  }

  openBulkUploadModal(): void {
    this.bulkMaterialSites = [this.getEmptyMaterialSite()];
    this.showBulkUploadModal = true;
  }

  closeBulkUploadModal(): void {
    this.showBulkUploadModal = false;
    this.bulkMaterialSites = [];
  }

  addBulkRow(): void {
    this.bulkMaterialSites.push(this.getEmptyMaterialSite());
  }

  removeBulkRow(index: number): void {
    this.bulkMaterialSites.splice(index, 1);
  }

  saveMaterialSite(): void {
    if (this.editingMaterialSite) {
      // Update existing
      this.supplierService.updateMaterialSite(this.editingMaterialSite.id, this.editingMaterialSite).subscribe({
        next: () => {
          this.loadMaterialSites();
          this.closeEditMaterialSiteModal();
        }
      });
    } else {
      // Create new
      this.supplierService.createMaterialSite(this.newMaterialSite).subscribe({
        next: () => {
          this.loadMaterialSites();
          this.closeMaterialSiteModal();
        }
      });
    }
  }

  saveBulkMaterialSites(): void {
    const validSites = this.bulkMaterialSites.filter(site => 
      site.material && site.materialLocation && site.county
    );
    
    if (validSites.length === 0) {
      alert('Please fill in at least one valid material site');
      return;
    }

    this.supplierService.createMultipleMaterialSites(validSites as MaterialSite[]).subscribe({
      next: () => {
        this.loadMaterialSites();
        this.closeBulkUploadModal();
        alert(`${validSites.length} material sites created successfully!`);
      },
      error: (error: any) => {
        console.error('Error creating bulk material sites:', error);
        alert('Error creating material sites');
      }
    });
  }

  editMaterialSite(site: MaterialSite): void {
    this.editingMaterialSite = { ...site };
    this.showEditMaterialSiteModal = true;
  }

  closeEditMaterialSiteModal(): void {
    this.showEditMaterialSiteModal = false;
    this.editingMaterialSite = null;
  }

  viewMaterialSiteDetails(site: MaterialSite): void {
    alert(`Material: ${site.material}\nLocation: ${site.materialLocation}\nCounty: ${site.county}\nOwner: ${site.ownerOfMaterial}\nVolume/Day: ${site.volumeProducedPerDay}\nEmployees: ${site.numberOfPeopleEmployed}`);
  }

  deleteMaterialSite(siteId: number): void {
    if (confirm('Are you sure you want to delete this material site?')) {
      this.supplierService.deleteMaterialSite(siteId).subscribe({
        next: () => {
          this.loadMaterialSites();
        }
      });
    }
  }

  // Filtering
  get filteredSuppliers(): Supplier[] {
    let filtered = this.suppliers;
    
    if (this.searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.companyName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        supplier.contactPerson?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        supplier.email?.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    
    if (this.supplierStatusFilter !== 'ALL') {
      filtered = filtered.filter(supplier => supplier.status === this.supplierStatusFilter);
    }
    
    return filtered;
  }

  get filteredMaterialSites(): MaterialSite[] {
    let filtered = this.materialSites;
    
    if (this.materialFilter) {
      filtered = filtered.filter(site =>
        site.material?.toLowerCase().includes(this.materialFilter.toLowerCase())
      );
    }
    
    if (this.countyFilter) {
      filtered = filtered.filter(site =>
        site.county?.toLowerCase().includes(this.countyFilter.toLowerCase())
      );
    }
    
    return filtered;
  }

  // Pagination
  get paginatedSuppliers(): Supplier[] {
    const startIndex = (this.currentSupplierPage - 1) * this.itemsPerPage;
    return this.filteredSuppliers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get paginatedMaterialSites(): MaterialSite[] {
    const startIndex = (this.currentMaterialPage - 1) * this.itemsPerPage;
    return this.filteredMaterialSites.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalSupplierPages(): number {
    return Math.ceil(this.filteredSuppliers.length / this.itemsPerPage);
  }

  get totalMaterialPages(): number {
    return Math.ceil(this.filteredMaterialSites.length / this.itemsPerPage);
  }

  // Export functionality
  exportSuppliersToCSV(): void {
    const data = this.filteredSuppliers.map(supplier => ({
      'Company Name': supplier.companyName,
      'Contact Person': supplier.contactPerson,
      'Email': supplier.email,
      'Phone': supplier.phone,
      'Business Reg No': supplier.businessRegistrationNumber,
      'Status': supplier.status,
      'Verified': supplier.verified ? 'Yes' : 'No',
      'Registration Date': new Date(supplier.createdAt).toLocaleDateString()
    }));

    this.exportToCSV(data, 'suppliers');
  }

  exportMaterialSitesToCSV(): void {
    const data = this.filteredMaterialSites.map(site => ({
      'Material': site.material,
      'Location': site.materialLocation,
      'County': site.county,
      'Sub-County': site.subCounty,
      'Owner': site.ownerOfMaterial,
      'Volume/Day': site.volumeProducedPerDay,
      'Employees': site.numberOfPeopleEmployed,
      'Usage': site.materialUsage
    }));

    this.exportToCSV(data, 'material_sites');
  }

  private exportToCSV(data: any[], filename: string): void {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item => Object.values(item).map(value => 
      typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
    ).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportSuppliersToPDF(): void {
    const doc = new jspdf.jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Suppliers Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Table
    const tableData = this.filteredSuppliers.map(supplier => [
      supplier.companyName,
      supplier.contactPerson,
      supplier.email,
      supplier.phone,
      supplier.status,
      supplier.verified ? 'Yes' : 'No'
    ]);
    
    autoTable(doc, {
      head: [['Company', 'Contact', 'Email', 'Phone', 'Status', 'Verified']],
      body: tableData,
      startY: 40,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    doc.save(`suppliers_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  exportMaterialSitesToPDF(): void {
    const doc = new jspdf.jsPDF('landscape');
    
    // Title
    doc.setFontSize(18);
    doc.text('Material Sites Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    
    // Table
    const tableData = this.filteredMaterialSites.map(site => [
      site.material,
      site.materialLocation,
      site.county,
      site.subCounty,
      site.ownerOfMaterial,
      site.volumeProducedPerDay,
      site.numberOfPeopleEmployed
    ]);
    
    autoTable(doc, {
      head: [['Material', 'Location', 'County', 'Sub-County', 'Owner', 'Volume/Day', 'Employees']],
      body: tableData,
      startY: 40,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    doc.save(`material_sites_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  getStatusClass(status: string): string {
    switch(status) {
      case 'APPROVED': return 'status-verified';
      case 'PENDING': return 'status-pending';
      case 'REJECTED': return 'status-rejected';
      case 'SUSPENDED': return 'status-suspended';
      default: return '';
    }
  }

  getMaterialColor(material: string): string {
    const materials: { [key: string]: string } = {
      'sand': '#f39c12',
      'gravel': '#95a5a6',
      'cement': '#7f8c8d',
      'bricks': '#e74c3c',
      'stones': '#34495e',
      'timber': '#8e44ad',
      'steel': '#3498db',
      'water': '#2980b9',
      'aggregate': '#d35400',
      'concrete': '#2c3e50'
    };
    return materials[material.toLowerCase()] || '#95a5a6';
  }
}