import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class ReactAdminPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'query') {
      let { filter, range, sort } = value;

      if (!range || !filter || !sort) {
        return {
          where: {},
          pagination: {
            skip: 0,
            pageSize: 20,
          },
          orderBy: {},
        };
      }
      // Pagination
      const rangeArr = JSON.parse(range) || [];
      const start = parseInt(rangeArr[0]);
      const end = parseInt(rangeArr[1]);
      const pageSize = end - start + 1;
      const skip = start;

      // Filter
      filter = JSON.parse(filter);

      // Sorting
      sort = JSON.parse(sort);

      return {
        where: { ...filter },
        pagination: {
          skip,
          pageSize,
        },
        orderBy: {
          [sort[0]]: sort[1].toLowerCase(),
        },
      };
    }
  }
}
