import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DataSource } from '../classes/model';
import { Observable, of, catchError, mergeMap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FileTextExtractionService {

  constructor(private http: HttpClient) { }

  private fileTypeMap = {
    img: ['image/jpeg', 'image/png', 'image/jpg'],
    pdf: ['application/pdf'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/mp3'],
    text: ['text/plain', 'text/txt', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  };

  private getDataSource(file: File): DataSource {
    if (this.fileTypeMap.img.includes(file.type)) return DataSource.IMAGE;
    if (this.fileTypeMap.pdf.includes(file.type)) return DataSource.PDF;
    if (this.fileTypeMap.audio.includes(file.type)) return DataSource.AUDIO;
    if (this.fileTypeMap.text.includes(file.type)) return DataSource.TEXT;
    return DataSource.UNKNOWN;
  }

  public uploadFile(baseUrl: string, file: File): Observable<{ extractedText: string, dataSource: DataSource, reachedServer: boolean }> {
    const dataSource = this.getDataSource(file);
    let formData: FormData = new FormData();
    formData.append('file', file, file.name);

    if (dataSource === DataSource.IMAGE) {
      return this.uploadAndProcessFile(`${baseUrl}/upload_image`, formData, dataSource);
    } else if (dataSource === DataSource.PDF) {
      return this.uploadAndProcessFile(`${baseUrl}/upload_pdf`, formData, dataSource);
    } else if (dataSource === DataSource.AUDIO) {
      return this.uploadAndProcessFile(`${baseUrl}/upload_audio`, formData, dataSource);
    } else if (dataSource === DataSource.TEXT) {
      return this.readFileAsText(file, dataSource);
    }

    // Return default observable for unknown types
    return of({ extractedText: "", dataSource, reachedServer: false });
  }

  private uploadAndProcessFile(url: string, formData: FormData, dataSource: DataSource): Observable<{ extractedText: string, dataSource: DataSource, reachedServer: boolean }> {
    return this.http.post(url, formData, { responseType: 'blob' }).pipe(
      mergeMap((blob: Blob) => this.processBlob(blob, dataSource)),
      catchError(() => of({ extractedText: "", dataSource, reachedServer: false })) // Handle HTTP errors
    );
  }

  private processBlob(blob: Blob, dataSource: DataSource): Observable<{ extractedText: string, dataSource: DataSource, reachedServer: boolean }> {
    return new Observable<{ extractedText: string, dataSource: DataSource, reachedServer: boolean }>(observer => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const dataString = reader.result as string;
          const tmpJSON = JSON.parse(dataString);
          const extractedText = tmpJSON.extracted_text || '';
          
          // Emit the result only after the onload event
          observer.next({
            extractedText,
            dataSource,
            reachedServer: true
          });
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      };
  
      reader.onerror = (error) => {
        observer.error(error);
      };
  
      // Start reading the blob (this is asynchronous)
      reader.readAsText(blob);
    }).pipe(
      catchError(() => of({ extractedText: "", dataSource, reachedServer: false })) // Handle blob read errors
    );
  }
  
  private readFileAsText(file: File, dataSource: DataSource): Observable<{ extractedText: string, dataSource: DataSource, reachedServer: boolean }> {
    return new Observable<{ extractedText: string, dataSource: DataSource, reachedServer: boolean }>(observer => {
      const reader = new FileReader();
  
      reader.onload = () => {
        try {
          const extractedText = reader.result as string;
  
          // Emit the result after reading the file
          observer.next({
            extractedText,
            dataSource,
            reachedServer: true
          });
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      };
  
      reader.onerror = (error) => {
        observer.error(error);
      };
  
      // Start reading the file (this is asynchronous)
      reader.readAsText(file);
    }).pipe(
      catchError(() => of({ extractedText: "", dataSource, reachedServer: false })) // Handle file read errors
    );
  }
}
