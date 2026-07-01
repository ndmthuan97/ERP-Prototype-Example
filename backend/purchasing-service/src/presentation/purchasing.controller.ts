/**
 * Purchasing Controller — Presentation Layer
 *
 * Controller delegates to Application layer (Command/Query).
 * No business logic here (Single Responsibility — SOLID "S").
 */
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiBody } from "@nestjs/swagger";

import {
  CreatePODtoSwagger,
  AddLinePODtoSwagger,
  ReceiveGoodsDtoSwagger,
  CancelPODtoSwagger,
} from "./swagger.dto.js";
import {
  CreatePOCommand,
  AddLinePOCommand,
  RemoveLinePOCommand,
  PlacePOCommand,
  ReceiveGoodsCommand,
  CancelPOCommand,
} from "../application/commands/index.js";
import { GetPOQuery, SearchPOsQuery } from "../application/queries/index.js";

@Controller("purchasing/orders")
export class PurchasingController {
  constructor(
    private readonly createPOCommand: CreatePOCommand,
    private readonly addLinePOCommand: AddLinePOCommand,
    private readonly removeLinePOCommand: RemoveLinePOCommand,
    private readonly placePOCommand: PlacePOCommand,
    private readonly receiveGoodsCommand: ReceiveGoodsCommand,
    private readonly cancelPOCommand: CancelPOCommand,
    private readonly getPOQuery: GetPOQuery,
    private readonly searchPOsQuery: SearchPOsQuery,
  ) {}

  /** POST /purchasing/orders — Create a new draft PO */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: CreatePODtoSwagger })
  async create(@Body() body: unknown) {
    return this.createPOCommand.execute(body);
  }

  /** GET /purchasing/orders — Search with pagination + status filter */
  @Get()
  async search(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const pageNumber = Number.parseInt(page ?? "", 10);
    const limitNumber = Number.parseInt(limit ?? "", 10);

    return this.searchPOsQuery.execute(
      status,
      Number.isNaN(pageNumber) ? undefined : pageNumber,
      Number.isNaN(limitNumber) ? undefined : limitNumber,
    );
  }

  /** GET /purchasing/orders/:id — Get PO detail with lines */
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.getPOQuery.execute(id);
  }

  /** POST /purchasing/orders/:id/lines — Add a line to draft PO */
  @Post(":id/lines")
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: AddLinePODtoSwagger })
  async addLine(@Param("id") id: string, @Body() body: unknown) {
    return this.addLinePOCommand.execute(id, body);
  }

  /** DELETE /purchasing/orders/:id/lines/:lineId — Remove a line from draft PO */
  @Delete(":id/lines/:lineId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLine(@Param("id") id: string, @Param("lineId") lineId: string) {
    await this.removeLinePOCommand.execute(id, lineId);
  }

  /** POST /purchasing/orders/:id/place — Place the PO (draft → placed) */
  @Post(":id/place")
  async place(@Param("id") id: string) {
    return this.placePOCommand.execute(id);
  }

  /** POST /purchasing/orders/:id/receive — Receive goods against PO */
  @Post(":id/receive")
  @ApiBody({ type: ReceiveGoodsDtoSwagger })
  async receive(@Param("id") id: string, @Body() body: unknown) {
    return this.receiveGoodsCommand.execute(id, body);
  }

  /** DELETE /purchasing/orders/:id — Cancel the PO */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: CancelPODtoSwagger, required: false })
  async cancel(@Param("id") id: string, @Body() body?: unknown) {
    return this.cancelPOCommand.execute(id, body);
  }
}
