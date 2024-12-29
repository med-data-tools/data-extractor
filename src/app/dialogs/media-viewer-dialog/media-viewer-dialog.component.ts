import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';



export class MediaViewerDialogData {

  constructor(
    public file: any,
  ) {}
}


@Component({
  selector: 'app-media-viewer-dialog',
  templateUrl: './media-viewer-dialog.component.html',
  styleUrls: ['./media-viewer-dialog.component.css']
})
export class MediaViewerDialogComponent {
  

  public mediaType: string|undefined;
  public mediaSrc: string|undefined;
  
  constructor(
  public dialogRef: MatDialogRef<MediaViewerDialogComponent>,
  @Inject(MAT_DIALOG_DATA) public data: MediaViewerDialogData){

  }

  ngOnInit(): void {

    const imgTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
    const textTypes = ['text/plain', 'application/pdf', 'text/txt', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    if(imgTypes.includes(this.data.file.type)) {
      this.mediaType = 'image';
        const reader = new FileReader();
        reader.onload = (e: any) => {
            this.mediaSrc = e.target.result;
        };
        reader.readAsDataURL(this.data.file);
    }else if (audioTypes.includes(this.data.file.type)) {
      this.mediaType = 'audio';
      const reader = new FileReader();
      reader.onload = (e: any) => {
          this.mediaSrc = e.target.result;
      };
      reader.readAsDataURL(this.data.file);
    }else if (textTypes.includes(this.data.file.type)) {
      this.mediaType = 'text';
      const reader = new FileReader();
      reader.onload = (e: any) => {
          this.mediaSrc = e.target.result;
      };
      reader.readAsText(this.data.file);
    }
  }


  


  public closeDialog(){
    this.dialogRef.close();
  }
}
