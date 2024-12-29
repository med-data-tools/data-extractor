import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CriterionDialogComponent } from './criterion-dialog.component';

describe('CriterionDialogComponent', () => {
  let component: CriterionDialogComponent;
  let fixture: ComponentFixture<CriterionDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CriterionDialogComponent]
    });
    fixture = TestBed.createComponent(CriterionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
