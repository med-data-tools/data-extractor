import { TestBed } from '@angular/core/testing';

import { FileTextExtractionService } from './file-text-extraction.service';

describe('FileTextExtractionService', () => {
  let service: FileTextExtractionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileTextExtractionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
