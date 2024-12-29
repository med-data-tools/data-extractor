import { Injectable } from '@angular/core';
import { ObjectMapper } from 'jackson-js';
import { Guideline } from '../classes/model';

@Injectable({
  providedIn: 'root'
})
export class SerializationService {

  constructor() { }

  serializeGuideline(guideline: Guideline): string {
    const objectMapper = new ObjectMapper();
    return objectMapper.stringify<Guideline>(guideline);
  }

  deserializeGuideline(jsonString: string): Guideline {
    const objectMapper = new ObjectMapper();
    return objectMapper.parse<Guideline>(jsonString, {mainCreator: () => [Guideline]});
  }
}
