import {
  BadRequestException, Body, Controller, Get, Inject, Post, Query, Req, UnsupportedMediaTypeException, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CASOS, Casos } from '../../composicion';
import { JwtGuard } from './jwt.guard';
import { ReporteDto } from './dto';

// Mismos formatos y tamaño que el microservicio de IA.
const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANIO_MAXIMO = 10 * 1024 * 1024;

@Controller('reportes')
export class ReportesController {
  constructor(@Inject(CASOS) private readonly casos: Casos) {}

  @Get('mios')
  @UseGuards(JwtGuard)
  misReportes(@Query('pagina') pagina: string | undefined, @Req() req: { user: { sub: number } }) {
    return this.casos.misReportes.ejecutar(Number(req.user.sub), Number(pagina ?? 1));
  }

  @Post()
  @UseGuards(JwtGuard)
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: TAMANIO_MAXIMO } }))
  async crear(
    @UploadedFile() foto: { buffer: Buffer; mimetype: string; originalname: string } | undefined,
    @Body() dto: ReporteDto,
    @Req() req: { user: { sub: number } },
  ) {
    if (!foto) throw new BadRequestException('Falta la foto (campo "foto")');
    if (!TIPOS_ACEPTADOS.includes(foto.mimetype)) {
      throw new UnsupportedMediaTypeException('Solo se aceptan JPEG, PNG o WebP');
    }
    return this.casos.registrarReporte.ejecutar({
      usuarioId: Number(req.user.sub),
      imagen: foto.buffer,
      nombreArchivo: foto.originalname,
      lat: dto.lat,
      lng: dto.lng,
      descripcion: dto.descripcion,
    });
  }
}