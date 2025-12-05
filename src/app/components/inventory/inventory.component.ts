import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MaterialService, Material } from '../add-site/material.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  materials: Material[] = [];
  filteredMaterials: Material[] = [];
  isLoading = false;
  errorMessage = '';
  supplierId: number | null = null;
  
  // Filter properties
  searchTerm = '';
  selectedCategory = '';

  constructor(
    private materialService: MaterialService,
    public router: Router
  ) {}

  ngOnInit() {
    this.loadInventory();
  }

  loadInventory() {
    this.supplierId = this.materialService.getSupplierId();
    
    if (!this.supplierId) {
      this.errorMessage = 'Unable to identify your supplier account. Please log in again.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    console.log('Loading inventory for supplier ID:', this.supplierId);

    this.materialService.getSupplierMaterials(this.supplierId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response && response.data) {
          this.materials = response.data;
          this.filteredMaterials = [...this.materials];
          console.log('Loaded materials:', this.materials);
        } else {
          this.materials = [];
          this.filteredMaterials = [];
          this.errorMessage = 'No materials found in your inventory.';
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading inventory:', error);
        
        if (error.message.includes('401') || error.message.includes('403')) {
          this.errorMessage = 'Please log in again to access your inventory.';
        } else if (error.message.includes('404')) {
          this.errorMessage = 'No materials found. Add your first material to get started.';
        } else {
          this.errorMessage = 'Failed to load inventory. Please try again.';
        }
      }
    });
  }

  // Filtering methods
  filterMaterials(searchTerm: string) {
    this.searchTerm = searchTerm.toLowerCase();
    this.applyFilters();
  }

  filterByCategory(category: string) {
    this.selectedCategory = category;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.materials];

    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(material => 
        material.category === this.selectedCategory
      );
    }

    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(material =>
        material.name.toLowerCase().includes(this.searchTerm) ||
        material.description?.toLowerCase().includes(this.searchTerm) ||
        material.category.toLowerCase().includes(this.searchTerm) ||
        material.location.toLowerCase().includes(this.searchTerm)
      );
    }

    this.filteredMaterials = filtered;
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.filteredMaterials = [...this.materials];
    
    // Reset input fields
    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    const categorySelect = document.querySelector('select') as HTMLSelectElement;
    
    if (searchInput) searchInput.value = '';
    if (categorySelect) categorySelect.value = '';
  }

  // Get unique categories from materials
  getUniqueCategories(): string[] {
    return Array.from(new Set(this.materials.map(m => m.category))).filter(Boolean);
  }

  // Computed properties for template
  get availableMaterialsCount(): number {
    return this.materials.filter(material => material.available).length;
  }

  get totalValue(): number {
    return this.materials.reduce((total, material) => total + material.price, 0);
  }

  get categoriesCount(): number {
    return this.getUniqueCategories().length;
  }

  // Material actions
  editMaterial(material: Material) {
    console.log('Edit material:', material);
    // In a real implementation, navigate to edit page or open modal
    this.router.navigate(['/supplier-dashboard/edit-material', material.id]);
  }

  toggleAvailability(material: Material) {
    const newAvailability = !material.available;
    const updatedMaterial = { ...material, available: newAvailability };
    
    this.materialService.updateMaterial(material.id, updatedMaterial).subscribe({
      next: (response) => {
        material.available = newAvailability;
        console.log(`Updated availability for ${material.name}`);
      },
      error: (error) => {
        console.error('Error updating availability:', error);
        alert('Failed to update availability. Please try again.');
      }
    });
  }

  deleteMaterial(material: Material) {
    if (confirm(`Are you sure you want to delete "${material.name}"? This action cannot be undone.`)) {
      this.materialService.deleteMaterial(material.id).subscribe({
        next: (response) => {
          this.materials = this.materials.filter(m => m.id !== material.id);
          this.filteredMaterials = this.filteredMaterials.filter(m => m.id !== material.id);
          console.log('Deleted material:', material);
          alert(`"${material.name}" has been deleted from your inventory.`);
        },
        error: (error) => {
          console.error('Error deleting material:', error);
          alert('Failed to delete material. Please try again.');
        }
      });
    }
  }

  // Refresh inventory
  refreshInventory() {
    this.loadInventory();
  }

  // Navigate to add material
  addNewMaterial() {
    this.router.navigate(['/supplier-dashboard/add-material']);
  }

  // Export functionality
  exportInventory(format: 'excel' | 'pdf') {
    const dataToExport = this.filteredMaterials.length > 0 ? this.filteredMaterials : this.materials;
    
    if (dataToExport.length === 0) {
      alert('No data to export.');
      return;
    }

    if (format === 'excel') {
      this.exportToExcel(dataToExport);
    } else if (format === 'pdf') {
      this.exportToPDF(dataToExport);
    }
  }

  private exportToExcel(materials: Material[]) {
    try {
      // Prepare data for Excel
      const excelData = materials.map(material => ({
        'Material Name': material.name,
        'Description': material.description || 'N/A',
        'Category': material.category,
        'Price': `${material.currency} ${material.price.toLocaleString()}`,
        'Unit': material.unit,
        'Location': material.location,
        'County': material.county || 'N/A',
        'Status': material.available ? 'Available' : 'Unavailable',
        'Added Date': this.formatDate(material.createdAt),
        'Minimum Order': material.minOrder || 'N/A'
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
      
      // Auto-size columns
      const maxWidth = excelData.reduce((w, r) => Math.max(w, r['Material Name'].length), 10);
      worksheet['!cols'] = [{ wch: maxWidth }];
      
      // Generate Excel file
      XLSX.writeFile(workbook, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      console.log('Excel export completed');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    }
  }

  private exportToPDF(materials: Material[]) {
    try {
      const doc = new jsPDF();
      const currentDate = new Date().toLocaleDateString();
      
      // Add title
      doc.setFontSize(18);
      doc.text('Material Inventory Report', 14, 22);
      
      // Add subtitle
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${currentDate}`, 14, 30);
      doc.text(`Total Items: ${materials.length} | Total Value: ${this.formatPrice(this.totalValue, 'KSH')}`, 14, 35);
      
      // Prepare table data
      const tableData = materials.map(material => [
        material.name,
        material.category,
        this.formatPrice(material.price, material.currency),
        material.location,
        material.available ? 'Available' : 'Unavailable',
        this.formatDate(material.createdAt)
      ]);
      
      // Add table
      autoTable(doc, {
        head: [['Material', 'Category', 'Price', 'Location', 'Status', 'Added On']],
        body: tableData,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 35 },
          4: { cellWidth: 20 },
          5: { cellWidth: 25 }
        }
      });
      
      // Add summary
      const finalY = (doc as any).lastAutoTable.finalY;
      doc.setFontSize(10);
      doc.text('Summary:', 14, finalY + 10);
      doc.text(`• Total Materials: ${materials.length}`, 14, finalY + 17);
      doc.text(`• Available: ${this.availableMaterialsCount}`, 14, finalY + 24);
      doc.text(`• Categories: ${this.categoriesCount}`, 14, finalY + 31);
      doc.text(`• Total Value: ${this.formatPrice(this.totalValue, 'KSH')}`, 14, finalY + 38);
      
      // Add footer
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('© Construction Material Marketplace - Confidential', 14, doc.internal.pageSize.height - 10);
      
      // Save PDF
      doc.save(`inventory_report_${new Date().toISOString().split('T')[0]}.pdf`);
      
      console.log('PDF export completed');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export to PDF. Please try again.');
    }
  }

  // Format date
  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }

  // Format price
  formatPrice(price: number, currency: string): string {
    try {
      // Handle different currencies
      if (currency === 'KSH') {
        return `KSH ${price.toLocaleString('en-KE')}`;
      } else if (currency === 'USD') {
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      } else {
        return `${currency} ${price.toLocaleString()}`;
      }
    } catch (error) {
      return `${currency} ${price}`;
    }
  }

  // View material details
  viewMaterialDetails(material: Material) {
    // In a real implementation, open a modal or navigate to details page
    console.log('View material details:', material);
    alert(`Material Details:\n\nName: ${material.name}\nCategory: ${material.category}\nPrice: ${this.formatPrice(material.price, material.currency)}\nLocation: ${material.location}\nStatus: ${material.available ? 'Available' : 'Unavailable'}`);
  }
}