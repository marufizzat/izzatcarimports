// Lê o TEXTO impresso numa foto com o Vision do macOS (grátis, offline).
// Usado pela conferência das capas maquiadas (ferramentas/capas_pro.py): o texto da etiqueta
// da peça tem que ser o MESMO na foto original e na maquiada.
// compilar: swiftc -O ferramentas/ocr.swift -o ~/.local/bin/izzat-ocr
// uso: izzat-ocr <foto> [<foto>...]  -> uma linha JSON por foto: {"a": caminho, "t": [[texto, confiança], ...]}
import Foundation
import Vision
import ImageIO

for caminho in CommandLine.arguments.dropFirst() {
  let url = URL(fileURLWithPath: caminho)
  var saida: [[Any]] = []
  if let src = CGImageSourceCreateWithURL(url as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = false
    try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    for o in req.results ?? [] {
      guard let c = o.topCandidates(1).first else { continue }
      saida.append([c.string, Double(c.confidence)])
    }
  }
  let obj: [String: Any] = ["a": caminho, "t": saida]
  if let d = try? JSONSerialization.data(withJSONObject: obj, options: []), let s = String(data: d, encoding: .utf8) {
    print(s)
  }
}
