import { Component, Output, EventEmitter } from '@angular/core';
import { Constants } from 'src/app/classes/constants';

/*
jz 2024-09-11: key is currently not used because the pure chat ai is currently not included. Maybe re-inserte / activate later or use for other purpose.
*/

export class SettingsData {
  constructor(
    public fileToTextServerAddress?: string,
    public llmServerAddress?: string,
    public key?: string,
    public showTrials?: boolean,
    public guidelineIndex?: number
  ) {}
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  @Output() public ping: EventEmitter<SettingsData> = new EventEmitter<SettingsData>();
  public currentlyLoadedGuidelineIndex: number = -1;
  public currentlyLoadedGuidelineName: string = "no name known";
  public numberOfGuidelines: number = Constants.PATH_DEMO_GUIDELINES.length;

  public fileToTextServerAddress: string = Constants.DEFAULT_FILE_TEXT_EXTRACTION_URL;
  public llmServerAddress: string = Constants.DEFAULT_LLM_URL;
  private key: string = '';
  public trials: boolean = false;
  public guidelineIndex: number = Constants.START_GUIDELINE_INDEX;

  public saveSettings(): void {
    this.ping.emit(new SettingsData(this.fileToTextServerAddress, this.llmServerAddress, this.key, this.trials, this.guidelineIndex));
  }

  public updateCurrentlyLoadedGuideline(index: number, name: string) {
    this.currentlyLoadedGuidelineIndex = index;
    this.currentlyLoadedGuidelineName = name;

    this.guidelineIndex = index;
  }
}
