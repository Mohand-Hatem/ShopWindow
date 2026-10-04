import { IsIn, IsOptional, IsString } from 'class-validator';

export class PurgeCacheDto {
  @IsIn(['product', 'lists', 'all'], {
    message: 'scope must be one of: product, lists, all',
  })
  scope: 'product' | 'lists' | 'all';

  @IsOptional()
  @IsString()
  id?: string;
}
