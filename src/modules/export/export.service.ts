import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { AttendanceService } from '../attendance/attendance.service';
import { CoursesService } from '../courses/courses.service';

export type ExportFormat = 'csv' | 'excel';

@Injectable()
export class ExportService {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly coursesService: CoursesService,
  ) {}

  async generate(
    courseId: string,
    format: ExportFormat,
    startDate?: string,
    endDate?: string,
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const course = await this.coursesService.findByIdRaw(courseId);
    let rows = await this.attendanceService.courseRoster(courseId, {});

    if (startDate) {
      rows = rows.filter((r) => new Date(r.date) >= new Date(startDate));
    }
    if (endDate) {
      rows = rows.filter((r) => new Date(r.date) <= new Date(endDate));
    }

    const safeCode = course.code.replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      return {
        buffer: this.toCsv(rows),
        fileName: `attendance_${safeCode}_${timestamp}.csv`,
        contentType: 'text/csv',
      };
    }

    return {
      buffer: await this.toExcel(rows, course.code),
      fileName: `attendance_${safeCode}_${timestamp}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private toCsv(
    rows: Array<{ studentId: string; studentName: string; date: Date; time: string | null; present: boolean }>,
  ): Buffer {
    const header = ['Student Name', 'Student ID', 'Date', 'Time', 'Status'];
    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

    const lines = [header.join(',')];
    for (const row of rows) {
      lines.push(
        [
          escape(row.studentName),
          escape(row.studentId),
          new Date(row.date).toISOString().slice(0, 10),
          row.time ?? '—',
          row.present ? 'Present' : 'Absent',
        ]
          .map(String)
          .join(','),
      );
    }
    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  private async toExcel(
    rows: Array<{ studentId: string; studentName: string; date: Date; time: string | null; present: boolean }>,
    courseCode: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AttendX';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`${courseCode} Attendance`.slice(0, 31));
    sheet.columns = [
      { header: 'Student Name', key: 'studentName', width: 28 },
      { header: 'Student ID', key: 'studentId', width: 18 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Time', key: 'time', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      sheet.addRow({
        studentName: row.studentName,
        studentId: row.studentId,
        date: new Date(row.date).toISOString().slice(0, 10),
        time: row.time ?? '—',
        status: row.present ? 'Present' : 'Absent',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
