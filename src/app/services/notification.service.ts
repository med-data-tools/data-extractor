import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NotificationDialogComponent } from '../dialogs/notification-dialog/notification-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(private dialog: MatDialog) { }

  notify(message: string, title: string = 'Notification'): void {
    if (typeof window !== 'undefined') {
      this.dialog.open(NotificationDialogComponent, {
        data: {
          title: title,
          message: message,
          isConfirm: false
        }
      });
    } else {
      console.log(new Date() + ": " + message); // fallback for server-side rendering
    }
  }

  confirm(message: string, title: string = 'Confirmation'): Promise<boolean> {
    if (typeof window !== 'undefined') {
      const dialogRef = this.dialog.open(NotificationDialogComponent, {
        data: {
          title: title,
          message: message,
          isConfirm: true
        }
      });

      return dialogRef.afterClosed().toPromise();
    } else {
      console.log(new Date() + ": Confirm dialog not available."); // fallback for server-side rendering
      return Promise.resolve(false);
    }
  }
}
