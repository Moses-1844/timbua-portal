import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaterialMap } from './material-map';

describe('MaterialMap', () => {
  let component: MaterialMap;
  let fixture: ComponentFixture<MaterialMap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialMap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaterialMap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
