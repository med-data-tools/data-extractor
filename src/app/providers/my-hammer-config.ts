import { HammerGestureConfig } from '@angular/platform-browser';
import { Injectable } from '@angular/core';
declare var Hammer: any;

@Injectable()
export class MyHammerConfig extends HammerGestureConfig {



  override overrides = {
    swipe: { direction: Hammer.DIRECTION_HORIZONTAL, threshold: 10, velocity: 0.3 }, // Adjust as necessary
  };
}
