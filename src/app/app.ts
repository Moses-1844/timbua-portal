import { Component } from '@angular/core';
import { MaterialMap } from './components/material-map/material-map';
import { DecisionSupport } from './components/decision-support/decision-support';
 

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MaterialMap, DecisionSupport],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  title = 'Timbua-Portal';
  
  // Colors for template binding
  colors = {
    kbrcDarkBlue: '#003366',
    kenyaBlack: '#000000',
    kenyaRed: '#BB0000',
    kenyaGreen: '#006600',
    kbrcBlue: '#0056B3',
    background: '#F8F9FA',
    kenyaWhite: '#FFFFFF',
    textPrimary: '#333333',
    textSecondary: '#666666'
  };

  // Dashboard state
  activeSection: 'materials' | 'support' = 'materials';
}