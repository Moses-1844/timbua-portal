import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DecisionSupport } from './decision-support';

describe('DecisionSupport', () => {
  let component: DecisionSupport;
  let fixture: ComponentFixture<DecisionSupport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionSupport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DecisionSupport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
