import { TestBed } from '@angular/core/testing';

import { TextExtractionService as TextExtractionService } from './text-extraction.service';

describe('TextExtractionService', () => {
  let service: TextExtractionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TextExtractionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
