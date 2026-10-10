import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DevAuthGuard } from './common/guards/dev-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DatabaseModule } from './database/database.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthController } from './modules/health/health.controller';
import {
  AuthController,
  UsersController,
  AssetsController,
  CategoriesController,
  ListingsController,
  BookingsController,
  InspectionsController,
  HandoverController,
  ReturnsController,
  MaintenanceController,
  DisputesController,
  TrustController,
  AssetHealthController,
  PaymentsController,
  LedgerController,
  AuditController,
  AdminDbController,
} from './modules/stubs.controllers';

@Module({
  imports: [DatabaseModule],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    AssetsController,
    CategoriesController,
    ListingsController,
    BookingsController,
    InspectionsController,
    HandoverController,
    ReturnsController,
    MaintenanceController,
    DisputesController,
    TrustController,
    AssetHealthController,
    PaymentsController,
    LedgerController,
    AuditController,
    AdminDbController,
  ],
  providers: [Reflector, DevAuthGuard, RolesGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
