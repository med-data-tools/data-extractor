import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { InputComponent } from './view/input/input.component';
import { DocumentsComponent } from './view/documents/documents.component';
import { Criterion, DataSource, Guideline, Range } from './classes/model';
import { Document } from './classes/document';
import { Constants } from './classes/constants';
import { NotificationService } from './services/notification.service';
import { SerializationService } from './services/serialization.service';
import { FileService } from './services/file.service';
import { SettingsComponent } from './view/settings/settings.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  @ViewChild('appInput') private appInput!: InputComponent;
  @ViewChild('appDocuments') private appDocuments!: DocumentsComponent;
  @ViewChild('settings') private settings!: SettingsComponent;
  
  title = 'data-extractor-angular';
  selectedTabIndex: number = 0;
  static readonly TAB_COUNT = 3;

  private fileToTextServerAddress: string = '';
  private llmServerAddress: string = '';
  private key: string = '';
  private showTrials: boolean = false;

  private guideline?: Guideline;
  private guidelineIndex: number = Constants.START_GUIDELINE_INDEX;

  constructor(private matIconRegistry: MatIconRegistry, private domSanitizer: DomSanitizer, private fileService: FileService, private notificationService: NotificationService, private serializationService: SerializationService) {}

  ngOnInit() {
    this.matIconRegistry.addSvgIcon('patient', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/tab-icons/patient.svg'));
    this.matIconRegistry.addSvgIcon('folder', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/tab-icons/folder.svg'));
    this.matIconRegistry.addSvgIcon('pencil', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/tab-icons/pencil.svg'));
    this.matIconRegistry.addSvgIcon('tools', this.domSanitizer.bypassSecurityTrustResourceUrl('assets/tab-icons/tools.svg'));

    this.setViewportHeight();
    window.addEventListener('resize', this.setViewportHeight.bind(this));
    window.addEventListener('orientationchange', this.setViewportHeight.bind(this));

    this.loadGuideline(this.guidelineIndex);
  }

  private loadGuideline(index: number) {
    this.fileService.readFile(Constants.PATH_DEMO_GUIDELINES[index]).subscribe({  
      next: data => { this.completeLoadGuideline(data) },
      error: err => this.notificationService.notify("Could not find demo guideline. Correct path specified? Error message: " + err.message)
    });
  }

  private completeLoadGuideline(fileContent: string) {
    try {
      this.guideline = this.serializationService.deserializeGuideline(fileContent);
      //pass this guideline to the children
      this.settings.updateCurrentlyLoadedGuideline(this.guidelineIndex, this.guideline.name);
      this.appInput.pingGuideline(this.guideline);
      this.appDocuments.pingGuideline(this.guideline);
    }
    catch (e) {
      this.notificationService.notify("Could not read demo guideline. File in correct json format? Error message: " + e);
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.setViewportHeight();
    this.appInput.scrollToBottom();
  }

  setViewportHeight() {
    if (window.visualViewport != undefined) {
      const vh = window.visualViewport.height;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    } else {
      const vh = window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
  }

  onSwipe(direction: string) {
    if (direction === 'left') {
      this.selectedTabIndex = Math.min(this.selectedTabIndex + 1, AppComponent.TAB_COUNT - 1);
    } else if (direction === 'right') {
      this.selectedTabIndex = Math.max(this.selectedTabIndex - 1, 0);
    }
  }


  public updateSettings(fileToTextServerAddress?: string, llmServerAddress?: string, key?: string, showTrials?: boolean, guidelineIndex?: number): void {
    this.fileToTextServerAddress = fileToTextServerAddress ?? this.fileToTextServerAddress;
    this.llmServerAddress = llmServerAddress ?? this.llmServerAddress;
    this.key = key ?? this.key;
    this.showTrials = showTrials ?? this.showTrials;
    var showUpdateNotification = true;
    if (guidelineIndex != undefined && guidelineIndex != this.guidelineIndex) {
      showUpdateNotification = false;
      this.notificationService.confirm("Load new guideline? All existing documents will be overwritten.", "Warning").then((confirmation: boolean) => {
        if (confirmation) {
          this.guidelineIndex = guidelineIndex;
          this.loadGuideline(this.guidelineIndex);
        }
      });
    }
    this.appInput.pingSettings(this.fileToTextServerAddress, this.llmServerAddress, this.key, this.showTrials);
    this.appDocuments.pingSettings(this.fileToTextServerAddress, this.llmServerAddress, this.key, this.showTrials);
    if (showUpdateNotification) {
      this.notificationService.notify("Settings have been updated.", "Settings");
    }
  }

  public updateCriterionValue(criterion: Criterion, value: string[] | Range | undefined, dataSource: DataSource, docID?: number, overwriteValue?: boolean): void {
    const doc = this.appDocuments.getDocumentById(docID ?? this.appDocuments.activeDocument);
    if (doc !== undefined) {
      this.appDocuments.updateCriterion(doc, criterion, value, dataSource, overwriteValue);
    }
  }
}
