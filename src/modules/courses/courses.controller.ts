import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { EnrollDto } from './dto/enroll.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's courses (enrolled for students, taught for lecturers)" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return user.role === UserRole.STUDENT
      ? this.coursesService.findStudentCourses(user.id)
      : this.coursesService.findLecturerCourses(user.id);
  }

  @Get('find-all')
  @Roles(UserRole.LECTURER, UserRole.STUDENT)
  findAll(){
    return this.coursesService.findAllCourses();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single course (role-aware view)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.findOneForUser(id, user.id, user.role);
  }

  @Post()
  @Roles(UserRole.LECTURER)
  @ApiOperation({ summary: 'Create a new course (lecturer only)' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCourseDto) {
    const course = await this.coursesService.create(user.id, dto);
    return this.coursesService.findOneForUser(course.id, user.id, UserRole.LECTURER);
  }

  @Patch(':id')
  @Roles(UserRole.LECTURER)
  @ApiOperation({ summary: "Update a course's details, venue, schedule or threshold (lecturer only, own courses)" })
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.update(id, user.id, dto);
  }

  @Post(':id/enroll')
  @Roles(UserRole.LECTURER, UserRole.STUDENT)
  @ApiOperation({ summary: 'Enroll a student in a course (lecturer only)' })
  enroll(@Param('id') id: string, @Body() dto: EnrollDto) {
    return this.coursesService.enrollStudent(id, dto.studentId);
  }

  @Get(':id/students')
  @Roles(UserRole.LECTURER)
  @ApiOperation({ summary: 'List enrolled students for a course (lecturer only)' })
  async students(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.coursesService.findOwnedByLecturer(id, user.id);
    const enrollments = await this.coursesService.listEnrollments(id);
    return enrollments.map((e) => ({
      studentId: e.student.studentId,
      fullName: e.student.fullName,
      email: e.student.email,
      classesHeld: e.classesHeld,
      classesAttended: e.classesAttended,
    }));
  }
}
