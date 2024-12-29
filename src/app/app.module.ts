import { NgModule } from '@angular/core';
import { BrowserModule, HAMMER_GESTURE_CONFIG, HammerModule } from '@angular/platform-browser';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select'; 
import { MatCheckboxModule } from '@angular/material/checkbox'; 
import { MatSliderModule } from '@angular/material/slider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatRadioModule } from '@angular/material/radio';
import { MainPipe } from './pipes/main-pipe-module.module';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { PatientsComponent } from './view/patients/patients.component';
import { DocumentsComponent } from './view/documents/documents.component';
import { InputComponent } from './view/input/input.component';
import { SettingsComponent } from './view/settings/settings.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CriterionDialogComponent } from './dialogs/criterion-dialog/criterion-dialog.component';
import { AddDocumentDialogComponent } from './dialogs/add-document-dialog/add-document-dialog.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MediaViewerDialogComponent } from './dialogs/media-viewer-dialog/media-viewer-dialog.component';
import { StateDialogComponent } from './dialogs/state-dialog/state-dialog.component';
import { TrialDialogComponent } from './dialogs/trial-dialog/trial-dialog.component';
import { PublicationDialogComponent } from './dialogs/publication-dialog/publication-dialog.component';
import { MyHammerConfig } from './providers/my-hammer-config';
import { NotificationDialogComponent } from './dialogs/notification-dialog/notification-dialog.component';
import { CriteriaListingComponent } from './view/criteria-listing/criteria-listing.component';
import { ImageDialogComponent } from './dialogs/image-dialog/image-dialog.component';


@NgModule({
  declarations: [
    AppComponent,
    PatientsComponent,
    DocumentsComponent,
    InputComponent,
    SettingsComponent,
    CriterionDialogComponent,
    AddDocumentDialogComponent,
    MediaViewerDialogComponent,
    StateDialogComponent,
    TrialDialogComponent,
    PublicationDialogComponent,
    NotificationDialogComponent,
    CriteriaListingComponent,
    ImageDialogComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    MatToolbarModule,
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
    MatInputModule,
    MatButtonModule,
    MatListModule,
    MatDialogModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSliderModule,
    MatExpansionModule,
    MatRadioModule,
    FormsModule,
    MatProgressSpinnerModule,
    MainPipe,
    HammerModule
  ],
  providers: [
    { provide: HAMMER_GESTURE_CONFIG, useClass: MyHammerConfig }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
