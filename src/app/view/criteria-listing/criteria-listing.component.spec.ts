import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CriteriaListingComponent } from './criteria-listing.component';

describe('CriteriaListingComponent', () => {
  let component: CriteriaListingComponent;
  let fixture: ComponentFixture<CriteriaListingComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CriteriaListingComponent]
    });
    fixture = TestBed.createComponent(CriteriaListingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
