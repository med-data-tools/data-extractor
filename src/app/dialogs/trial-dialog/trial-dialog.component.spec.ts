import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrialDialogComponent } from './trial-dialog.component';

describe('TrialDialogComponent', () => {
  let component: TrialDialogComponent;
  let fixture: ComponentFixture<TrialDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TrialDialogComponent]
    });
    fixture = TestBed.createComponent(TrialDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
