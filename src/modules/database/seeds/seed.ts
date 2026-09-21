import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../../app.module';
import { User } from '../../users/entities/user.entity';
import { Course } from '../../courses/entities/course.entity';
import { Enrollment } from '../../courses/entities/enrollment.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

/**
 * Seeds a demo lecturer, a demo student, a couple of courses and
 * enrollments with some attendance history already on the books — so
 * the Flutter app has something realistic to show immediately after
 * `npm run seed`. Safe to re-run: skips anything that already exists.
 */
async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const usersRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const coursesRepo = app.get<Repository<Course>>(getRepositoryToken(Course));
  const enrollmentsRepo = app.get<Repository<Enrollment>>(getRepositoryToken(Enrollment));

  const passwordHash = await bcrypt.hash('password123', 10);

  let lecturer = await usersRepo.findOne({ where: { email: 's.johnson@uniport.edu.ng' } });
  if (!lecturer) {
    lecturer = await usersRepo.save(
      usersRepo.create({
        fullName: 'Samuel Johnson',
        email: 's.johnson@uniport.edu.ng',
        passwordHash,
        role: UserRole.LECTURER,
        department: 'Computer Science',
        faculty: 'Faculty of Computing',
        staffId: 'STF/0042',
        title: 'Dr.',
      }),
    );
    console.log('Created lecturer: s.johnson@uniport.edu.ng / password123');
  }

  let student = await usersRepo.findOne({ where: { email: 'nicholas.johnson@uniport.edu.ng' } });
  if (!student) {
    student = await usersRepo.save(
      usersRepo.create({
        fullName: 'Nicholas Johnson',
        email: 'nicholas.johnson@uniport.edu.ng',
        passwordHash,
        role: UserRole.STUDENT,
        department: 'Computer Science',
        faculty: 'Faculty of Computing',
        studentId: 'CSC/21/1234',
        semester: 'Rain Semester, 2025/2026',
      }),
    );
    console.log('Created student: nicholas.johnson@uniport.edu.ng / password123');
  }

  const courseSeeds = [
    {
      code: 'CSC 416',
      title: 'Software Engineering',
      description: 'Principles of large-scale software design, architecture, testing and project management.',
      creditUnits: 3,
      department: 'Computer Science',
      scheduleDay: 'Monday',
      scheduleStartTime: '10:00 AM',
      scheduleEndTime: '12:00 PM',
      venue: 'Lab 3',
      maxStudents: 100,
      attendanceThreshold: 75,
      classesHeld: 20,
      classesAttended: 18,
    },
    {
      code: 'CSC 408',
      title: 'Artificial Intelligence',
      description: 'Search, knowledge representation, and machine learning foundations.',
      creditUnits: 3,
      department: 'Computer Science',
      scheduleDay: 'Tuesday',
      scheduleStartTime: '8:00 AM',
      scheduleEndTime: '10:00 AM',
      venue: 'LT 1',
      maxStudents: 120,
      attendanceThreshold: 75,
      classesHeld: 18,
      classesAttended: 11,
    },
  ];

  for (const seedData of courseSeeds) {
    let course = await coursesRepo.findOne({ where: { code: seedData.code, lecturerId: lecturer.id } });
    if (!course) {
      course = await coursesRepo.save(
        coursesRepo.create({
          code: seedData.code,
          title: seedData.title,
          description: seedData.description,
          lecturerId: lecturer.id,
          creditUnits: seedData.creditUnits,
          department: seedData.department,
          scheduleDay: seedData.scheduleDay,
          scheduleStartTime: seedData.scheduleStartTime,
          scheduleEndTime: seedData.scheduleEndTime,
          scheduleRecurringWeekly: true,
          venue: seedData.venue,
          maxStudents: seedData.maxStudents,
          attendanceThreshold: seedData.attendanceThreshold,
        }),
      );
      console.log(`Created course: ${seedData.code}`);
    }

    const existingEnrollment = await enrollmentsRepo.findOne({
      where: { courseId: course.id, studentId: student.id },
    });
    if (!existingEnrollment) {
      await enrollmentsRepo.save(
        enrollmentsRepo.create({
          courseId: course.id,
          studentId: student.id,
          classesHeld: seedData.classesHeld,
          classesAttended: seedData.classesAttended,
        }),
      );
      console.log(`Enrolled ${student.email} in ${seedData.code}`);
    }
  }

  console.log('\nSeed complete. Demo accounts:');
  console.log('  Lecturer: s.johnson@uniport.edu.ng / password123');
  console.log('  Student:  nicholas.johnson@uniport.edu.ng / password123');

  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
