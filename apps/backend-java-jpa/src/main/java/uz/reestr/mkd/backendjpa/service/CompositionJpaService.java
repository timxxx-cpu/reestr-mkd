package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.UpdateBlockConstructionRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.UpdateBlockEngineeringRequest;
import uz.reestr.mkd.backendjpa.entity.BlockConstructionEntity;
import uz.reestr.mkd.backendjpa.entity.BlockEngineeringEntity;
import uz.reestr.mkd.backendjpa.entity.BlockEntity;
import uz.reestr.mkd.backendjpa.repository.BlockConstructionRepository;
import uz.reestr.mkd.backendjpa.repository.BlockEngineeringRepository;
import uz.reestr.mkd.backendjpa.repository.BlockRepository;

@Service
public class CompositionJpaService {

  private final BlockRepository blockRepository;
  private final BlockConstructionRepository blockConstructionRepository;
  private final BlockEngineeringRepository blockEngineeringRepository;
  private final ObjectMapper objectMapper;

  public CompositionJpaService(
      BlockRepository blockRepository,
      BlockConstructionRepository blockConstructionRepository,
      BlockEngineeringRepository blockEngineeringRepository,
      ObjectMapper objectMapper
  ) {
    this.blockRepository = blockRepository;
    this.blockConstructionRepository = blockConstructionRepository;
    this.blockEngineeringRepository = blockEngineeringRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public JsonNode updateBlockConstruction(UUID blockId, UpdateBlockConstructionRequest request) {
    if (request == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Construction payload is required");
    }

    BlockEntity block = getBlock(blockId);
    BlockConstructionEntity entity = blockConstructionRepository.findByBlockId(blockId)
        .orElseGet(() -> BlockConstructionEntity.builder().block(block).build());

    entity.setFoundation(trimToNull(request.foundation()));
    entity.setWalls(trimToNull(request.walls()));
    entity.setSlabs(trimToNull(request.slabs()));
    entity.setRoof(trimToNull(request.roof()));
    entity.setSeismicity(request.seismicity());
    entity.setBlock(block);

    BlockConstructionEntity saved = blockConstructionRepository.save(entity);
    block.setBlockConstruction(saved);

    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", saved.getId() == null ? null : saved.getId().toString());
    node.put("block_id", blockId.toString());
    node.put("foundation", saved.getFoundation());
    node.put("walls", saved.getWalls());
    node.put("slabs", saved.getSlabs());
    node.put("roof", saved.getRoof());
    node.put("seismicity", saved.getSeismicity());
    return node;
  }

  @Transactional
  public JsonNode updateBlockEngineering(UUID blockId, UpdateBlockEngineeringRequest request) {
    if (request == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Engineering payload is required");
    }

    BlockEntity block = getBlock(blockId);
    BlockEngineeringEntity entity = blockEngineeringRepository.findByBlockId(blockId)
        .orElseGet(() -> BlockEngineeringEntity.builder().block(block).build());

    entity.setHasElectricity(Boolean.TRUE.equals(request.electricity()));
    entity.setHasWater(Boolean.TRUE.equals(request.hvs()));
    entity.setHasHotWater(Boolean.TRUE.equals(request.gvs()));
    entity.setHasSewerage(Boolean.TRUE.equals(request.sewerage()));
    entity.setHasGas(Boolean.TRUE.equals(request.gas()));
    entity.setHasHeatingLocal(Boolean.TRUE.equals(request.heatingLocal()));
    entity.setHasHeatingCentral(Boolean.TRUE.equals(request.heatingCentral()));
    entity.setHasHeating(Boolean.TRUE.equals(request.heatingLocal()) || Boolean.TRUE.equals(request.heatingCentral()));
    entity.setHasVentilation(Boolean.TRUE.equals(request.ventilation()));
    entity.setHasFirefighting(Boolean.TRUE.equals(request.firefighting()));
    entity.setHasLowcurrent(Boolean.TRUE.equals(request.lowcurrent()));
    entity.setHasInternet(Boolean.TRUE.equals(request.internet()));
    entity.setHasSolarPanels(Boolean.TRUE.equals(request.solarPanels()));
    entity.setBlock(block);

    BlockEngineeringEntity saved = blockEngineeringRepository.save(entity);
    block.setBlockEngineering(saved);

    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", saved.getId() == null ? null : saved.getId().toString());
    node.put("block_id", blockId.toString());
    node.put("has_electricity", Boolean.TRUE.equals(saved.getHasElectricity()));
    node.put("has_water", Boolean.TRUE.equals(saved.getHasWater()));
    node.put("has_hot_water", Boolean.TRUE.equals(saved.getHasHotWater()));
    node.put("has_sewerage", Boolean.TRUE.equals(saved.getHasSewerage()));
    node.put("has_gas", Boolean.TRUE.equals(saved.getHasGas()));
    node.put("has_heating_local", Boolean.TRUE.equals(saved.getHasHeatingLocal()));
    node.put("has_heating_central", Boolean.TRUE.equals(saved.getHasHeatingCentral()));
    node.put("has_heating", Boolean.TRUE.equals(saved.getHasHeating()));
    node.put("has_ventilation", Boolean.TRUE.equals(saved.getHasVentilation()));
    node.put("has_firefighting", Boolean.TRUE.equals(saved.getHasFirefighting()));
    node.put("has_lowcurrent", Boolean.TRUE.equals(saved.getHasLowcurrent()));
    node.put("has_internet", Boolean.TRUE.equals(saved.getHasInternet()));
    node.put("has_solar_panels", Boolean.TRUE.equals(saved.getHasSolarPanels()));
    return node;
  }


  public ObjectNode objectNode() {
    return objectMapper.createObjectNode();
  }
  private BlockEntity getBlock(UUID blockId) {
    return blockRepository.findById(blockId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Block not found"));
  }

  private String trimToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
