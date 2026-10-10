import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
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
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
