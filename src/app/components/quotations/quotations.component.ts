import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quotations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quotations.component.html',
  styleUrls: ['./quotations.component.scss']
})
export class QuotationsComponent {
  quotations = JSON.parse(localStorage.getItem('quotations') || '[]');

  markSent(q: any) {
    q.status = 'sent';
    localStorage.setItem('quotations', JSON.stringify(this.quotations));
  }
}
