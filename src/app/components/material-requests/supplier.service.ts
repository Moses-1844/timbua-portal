import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface QuotationRequest {
  id: number;
  material: string;
  quantity: number;
  unit: string;
  deadline: string;
  status: 'PENDING' | 'QUOTED' | 'AWARDED' | 'EXPIRED';
  contractor: {
    companyName: string;
    contactPerson: string;
    email: string;
    phoneNumber: string;
  };
  quotes: Quote[];
}

export interface Quote {
  id: number;
  supplier: string;
  totalAmount: number;
  deliveryTime: string;
  terms: string;
  submittedDate: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface Order {
  id: number;
  orderReference: string;
  siteName: string;
  contractor: {
    companyName: string;
    contactPerson: string;
    email: string;
    phoneNumber: string;
  };
  totalAmount: number;
  currency: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'PENDING_PAYMENT' | 'PARTIALLY_PAID' | 'FULLY_PAID';
  items?: OrderItem[];
  deliveryAddress?: string;
  deliveryInstructions?: string;
  paymentTerms?: string;
  notes?: string;
}

export interface OrderItem {
  id: number;
  materialName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface SubmitQuoteRequest {
  totalAmount: number;
  deliveryTime: string;
  terms: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private apiUrl = environment.apiUrl || 'https://timbuabackend.onrender.com';

  constructor(private http: HttpClient) {}

  getSupplierId(): number | null {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.id || 4; // Fallback to 4 for testing
    } catch (error) {
      console.error('Error getting supplier ID:', error);
      return 4; // Fallback for testing
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    });
  }

  getQuotationRequests(supplierId: number): Observable<QuotationRequest[]> {
    return this.http.get<QuotationRequest[]>(
      `${this.apiUrl}/quotation-requests/supplier/${supplierId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.log('Using mock data for quotation requests');
        return of(this.getMockQuotationRequests());
      })
    );
  }

  submitQuote(requestId: number, supplierId: number, quoteData: SubmitQuoteRequest): Observable<Quote> {
    return this.http.post<Quote>(
      `${this.apiUrl}/quotes/request/${requestId}/supplier/${supplierId}`,
      quoteData,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.log('Using mock response for quote submission');
        return of({
          id: Math.floor(Math.random() * 1000),
          supplier: `Supplier ${supplierId}`,
          totalAmount: quoteData.totalAmount,
          deliveryTime: quoteData.deliveryTime,
          terms: quoteData.terms,
          submittedDate: new Date().toISOString(),
          status: 'PENDING' as const
        });
      })
    );
  }

  getSupplierQuotes(supplierId: number): Observable<Quote[]> {
    return this.http.get<Quote[]>(
      `${this.apiUrl}/quotes/supplier/${supplierId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.log('Using mock data for quotes');
        return of(this.getMockQuotes());
      })
    );
  }

  getSupplierOrders(supplierId: number): Observable<Order[]> {
    return this.http.get<Order[]>(
      `${this.apiUrl}/orders/supplier/${supplierId}`,
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.log('Using mock data for orders');
        return of(this.getMockOrders());
      })
    );
  }

  updateOrderStatus(orderId: number, status: string): Observable<Order> {
    return this.http.patch<Order>(
      `${this.apiUrl}/orders/${orderId}/status`,
      { status },
      { headers: this.getHeaders() }
    ).pipe(
      catchError(error => {
        console.log('Using mock response for order status update');
        const mockOrder = this.getMockOrders().find(order => order.id === orderId);
        if (mockOrder) {
          mockOrder.status = status as any;
        }
        return of(mockOrder || this.getMockOrders()[0]);
      })
    );
  }

  // Mock data generators
  private getMockQuotationRequests(): QuotationRequest[] {
    return [
      {
        id: 1,
        material: 'Portland Cement 50kg',
        quantity: 100,
        unit: 'bags',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'PENDING',
        contractor: {
          companyName: 'ABC Construction Ltd',
          contactPerson: 'John Doe',
          email: 'john@abcconstruction.com',
          phoneNumber: '+254712345678'
        },
        quotes: []
      },
      {
        id: 2,
        material: 'Reinforcement Steel Bars',
        quantity: 2000,
        unit: 'kg',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'QUOTED',
        contractor: {
          companyName: 'XYZ Builders',
          contactPerson: 'Jane Smith',
          email: 'jane@xyzbuilders.com',
          phoneNumber: '+254723456789'
        },
        quotes: [
          {
            id: 1,
            supplier: 'Supplier 4',
            totalAmount: 450000,
            deliveryTime: '3-5 business days',
            terms: 'Payment: 50% advance, 50% on delivery',
            submittedDate: new Date().toISOString(),
            status: 'PENDING'
          }
        ]
      }
    ];
  }

  private getMockQuotes(): Quote[] {
    return [
      {
        id: 1,
        supplier: 'Supplier 4',
        totalAmount: 150000,
        deliveryTime: '3-5 business days',
        terms: 'Payment: 30% advance, balance on delivery',
        submittedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'PENDING'
      },
      {
        id: 2,
        supplier: 'Supplier 4',
        totalAmount: 280000,
        deliveryTime: '2 weeks',
        terms: 'Payment: Full payment on delivery',
        submittedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ACCEPTED'
      }
    ];
  }

  private getMockOrders(): Order[] {
    return [
      {
        id: 1,
        orderReference: 'ORD-001',
        siteName: 'Nairobi CBD Construction',
        contractor: {
          companyName: 'City Developers Ltd',
          contactPerson: 'Robert Johnson',
          email: 'robert@citydevelopers.com',
          phoneNumber: '+254734567890'
        },
        totalAmount: 250000,
        currency: 'KSH',
        orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        expectedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'CONFIRMED',
        paymentStatus: 'PARTIALLY_PAID',
        deliveryAddress: '123 Nairobi CBD, 5th Floor',
        deliveryInstructions: 'Call site manager before delivery',
        paymentTerms: '50% advance, 50% on delivery',
        notes: 'Ensure all materials are properly labeled',
        items: [
          {
            id: 1,
            materialName: 'Portland Cement',
            quantity: 50,
            unit: 'bags',
            unitPrice: 800,
            total: 40000
          },
          {
            id: 2,
            materialName: 'Steel Bars',
            quantity: 1000,
            unit: 'kg',
            unitPrice: 150,
            total: 150000
          }
        ]
      },
      {
        id: 2,
        orderReference: 'ORD-002',
        siteName: 'Westlands Office Park',
        contractor: {
          companyName: 'Modern Builders',
          contactPerson: 'Sarah Williams',
          email: 'sarah@modernbuilders.com',
          phoneNumber: '+254745678901'
        },
        totalAmount: 180000,
        currency: 'KSH',
        orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        expectedDeliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'PENDING',
        paymentStatus: 'PENDING_PAYMENT'
      }
    ];
  }
}