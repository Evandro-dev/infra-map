/** Dimensões físicas, independentes do zoom do navegador. */
export class RectangleDimensions {
  private _width!: number;
  private _height!: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  get width() {
    return this._width;
  }
  set width(value: number) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('Largura inválida');
    this._width = value;
  }
  get height() {
    return this._height;
  }
  set height(value: number) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('Altura inválida');
    this._height = value;
  }
  get area() {
    return this.width * this.height;
  }
}
