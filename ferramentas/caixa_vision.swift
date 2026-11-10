// Vision em laço (o modelo carrega uma vez só), uma foto por linha no stdin:
//   "entrada\tsaida.png" -> recorte do primeiro plano (todas as instâncias, como o recorta-fundo):
//                           responde OK | SEM (nenhum primeiro plano) | ERRO n
//   "TEXTO\tentrada"     -> texto impresso na foto (OCR preciso): responde "T <área> <linhas> <texto>", área = soma
//                           das caixas das linhas lidas com confiança (fração da foto, 0-1) e o texto delas separado
//                           por " | "; ERRO n se não leu a foto. (O OCR rápido via "texto" em aletas de radiador.)
import Foundation
import Vision
import CoreImage

let contexto = CIContext()
let espaco = CGColorSpace(name: CGColorSpace.sRGB)!
setvbuf(stdout, nil, _IOLBF, 0)

func texto(_ caminho: String) -> String {
    guard let imagem = CIImage(contentsOf: URL(fileURLWithPath: caminho)) else { return "ERRO 3" }
    let pedido = VNRecognizeTextRequest()
    pedido.recognitionLevel = .accurate
    pedido.usesLanguageCorrection = false
    do { try VNImageRequestHandler(ciImage: imagem, options: [:]).perform([pedido]) } catch { return "ERRO 4" }
    var area = 0.0
    var lidas: [String] = []
    for o in pedido.results ?? [] {
        guard let c = o.topCandidates(1).first, c.confidence >= 0.5,
              c.string.filter({ $0.isLetter || $0.isNumber }).count >= 3 else { continue }
        area += Double(o.boundingBox.width * o.boundingBox.height)
        lidas.append(c.string.replacingOccurrences(of: "|", with: "/").replacingOccurrences(of: "\t", with: " "))
    }
    return String(format: "T %.4f %d ", min(area, 1.0), lidas.count) + lidas.joined(separator: " | ")
}

func recorte(_ entrada: String, _ saida: String) -> String {
    guard let imagem = CIImage(contentsOf: URL(fileURLWithPath: entrada)) else { return "ERRO 3" }
    let handler = VNImageRequestHandler(ciImage: imagem, options: [:])
    let pedido = VNGenerateForegroundInstanceMaskRequest()
    do { try handler.perform([pedido]) } catch { return "ERRO 4" }
    guard let r = pedido.results?.first else { return "SEM" }
    do {
        let buf = try r.generateMaskedImage(ofInstances: r.allInstances, from: handler, croppedToInstancesExtent: false)
        try contexto.writePNGRepresentation(of: CIImage(cvPixelBuffer: buf), to: URL(fileURLWithPath: saida), format: .RGBA8, colorSpace: espaco)
        return "OK"
    } catch { return "ERRO 7" }
}

while let linha = readLine() {
    let partes = linha.components(separatedBy: "\t")
    if partes.count != 2 { print("ERRO 2"); continue }
    let resposta: String = autoreleasepool {
        partes[0] == "TEXTO" ? texto(partes[1]) : recorte(partes[0], partes[1])
    }
    print(resposta)
}
